import { tool } from "ai";
import { z } from "zod";

const YAHOO = "https://query1.finance.yahoo.com";
const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0" };

// Only the fields we actually read from Yahoo's responses. Parsing these
// turns a silent format change into a clear per-symbol error.
const yahooChartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            symbol: z.string(),
            currency: z.string(),
            longName: z.string().optional(),
            shortName: z.string().optional(),
            regularMarketPrice: z.number(),
            regularMarketTime: z.number(),
            chartPreviousClose: z.number(),
          }),
          timestamp: z.array(z.number()).optional(),
          indicators: z.object({
            quote: z.array(z.object({ close: z.array(z.number().nullable()).optional() })),
          }),
        }),
      )
      .nullable(),
  }),
});

const yahooSearchSchema = z.object({
  quotes: z
    .array(
      z.object({
        symbol: z.string(),
        quoteType: z.string().optional(),
        shortname: z.string().optional(),
        longname: z.string().optional(),
        exchDisp: z.string().optional(),
      }),
    )
    .default([]),
});

async function fetchChart(symbol: string, range: string, interval: string) {
  const ticker = symbol.trim().toUpperCase();
  const res = await fetch(
    `${YAHOO}/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`,
    { headers: YAHOO_HEADERS, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`No data found for ${ticker}`);

  const parsed = yahooChartSchema.safeParse(await res.json());
  const result = parsed.success ? parsed.data.chart.result?.[0] : undefined;
  if (!result) throw new Error(`Unexpected data format for ${ticker}`);
  return result;
}

// Turns a company name or ticker into a listed stock's symbol. An exact
// ticker match wins; otherwise the top equity result for the name.
async function resolveSymbol(query: string) {
  const q = query.trim();
  const res = await fetch(
    `${YAHOO}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=6&newsCount=0`,
    { headers: YAHOO_HEADERS, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Symbol search failed for ${q}`);

  const parsed = yahooSearchSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`Unexpected search format for ${q}`);

  const equities = parsed.data.quotes.filter((r) => r.quoteType === "EQUITY");
  const match = equities.find((r) => r.symbol === q.toUpperCase()) ?? equities[0];
  if (!match) throw new Error(`${q} is not a publicly traded company`);
  return match.symbol;
}

const COMPANY_DESCRIPTION =
  "Company name or ticker exactly as the user wrote it, e.g. 'nvidia' or 'AAPL'. " +
  "Do not convert names to tickers yourself.";

export const getStockQuote = tool({
  description:
    "Get the latest stock price for a company. Use this for any question about current " +
    "share prices. Fails if the company is not publicly traded.",
  inputSchema: z.object({
    company: z.string().describe(COMPANY_DESCRIPTION),
  }),
  execute: async ({ company }) => {
    const { meta } = await fetchChart(await resolveSymbol(company), "1d", "1d");
    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose;
    return {
      symbol: meta.symbol,
      name: meta.longName ?? meta.shortName ?? meta.symbol,
      currency: meta.currency,
      price,
      change: price - previousClose,
      changePercent: ((price - previousClose) / previousClose) * 100,
      asOf: new Date(meta.regularMarketTime * 1000).toISOString(),
    };
  },
});

const RANGE_INTERVALS = {
  "1d": "5m",
  "5d": "30m",
  "1mo": "1d",
  "6mo": "1d",
  ytd: "1d",
  "1y": "1d",
  "5y": "1wk",
} as const;

export type StockRange = keyof typeof RANGE_INTERVALS;

const MAX_POINTS = 260;

async function fetchSeries(company: string, range: StockRange) {
  const result = await fetchChart(await resolveSymbol(company), range, RANGE_INTERVALS[range]);
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators.quote[0]?.close ?? [];

  let points = timestamps.flatMap((t, i) => {
    const close = closes[i];
    return close == null ? [] : [{ t: t * 1000, close }];
  });
  if (points.length > MAX_POINTS) {
    const step = points.length / MAX_POINTS;
    points = [
      ...Array.from({ length: MAX_POINTS - 1 }, (_, i) => points[Math.floor(i * step)]),
      points[points.length - 1],
    ];
  }
  if (points.length < 2) throw new Error(`Not enough price history for ${result.meta.symbol}`);

  const start = points[0].close;
  const end = points[points.length - 1].close;
  const closesOnly = points.map((p) => p.close);
  return {
    symbol: result.meta.symbol,
    name: result.meta.longName ?? result.meta.shortName ?? result.meta.symbol,
    currency: result.meta.currency,
    points,
    start,
    end,
    change: end - start,
    changePercent: ((end - start) / start) * 100,
    high: Math.max(...closesOnly),
    low: Math.min(...closesOnly),
  };
}

export const getStockHistory = tool({
  description:
    "Get price history for one or more companies over a time range. The result is shown " +
    "to the user as a chart. Use it for trends, performance over time, or comparing stocks.",
  inputSchema: z.object({
    companies: z.array(z.string().describe(COMPANY_DESCRIPTION)).min(1).max(5),
    range: z
      .enum(Object.keys(RANGE_INTERVALS) as [StockRange, ...StockRange[]])
      .describe("Time range: 1d, 5d, 1mo, 6mo, ytd, 1y or 5y"),
  }),
  execute: async ({ companies, range }) => {
    const results = await Promise.allSettled(companies.map((c) => fetchSeries(c, range)));
    return {
      range,
      series: results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
      errors: results.flatMap((r, i) =>
        r.status === "rejected"
          ? [{ company: companies[i], message: String(r.reason?.message ?? r.reason) }]
          : [],
      ),
    };
  },
});
