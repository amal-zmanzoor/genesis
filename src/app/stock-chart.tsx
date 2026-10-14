"use client";

import type { InferUITools } from "ai";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { chatTools } from "@/lib/chat-tools";

type StockHistory = InferUITools<typeof chatTools>["getStockHistory"]["output"];

const LINE_COLORS = ["#6c63ff", "#34c79a", "#f9ddb0", "#f7c6d9", "#c9e4f6"];

const RANGE_LABELS: Record<StockHistory["range"], string> = {
  "1d": "today",
  "5d": "over 5 days",
  "1mo": "over 1 month",
  "6mo": "over 6 months",
  ytd: "year to date",
  "1y": "over 1 year",
  "5y": "over 5 years",
};

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function StockChartPlaceholder() {
  return (
    <div className="mb-2 flex h-64 items-center justify-center rounded-xl bg-surface text-xs text-muted">
      📊 Loading chart…
    </div>
  );
}

export function StockChart({ data }: { data: StockHistory }) {
  const { series, errors, range } = data;
  const intraday = range === "1d" || range === "5d";
  const compare = series.length > 1;

  // One row per timestamp, with a column per symbol. When comparing, plot
  // % change from each series' first point so different prices share an axis.
  const rows = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const p of s.points) {
      const row = rows.get(p.t) ?? { t: p.t };
      row[s.symbol] = compare ? ((p.close - s.start) / s.start) * 100 : p.close;
      rows.set(p.t, row);
    }
  }
  const chartData = [...rows.values()].sort((a, b) => a.t - b.t);

  const formatTime = (t: number) =>
    new Date(t).toLocaleString(undefined, intraday
      ? { weekday: range === "5d" ? "short" : undefined, hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short", year: range === "5y" ? "2-digit" : undefined });
  const formatValue = (v: number) => (compare ? formatPercent(v) : v.toFixed(2));

  return (
    <div className="mb-2 rounded-xl bg-surface p-3">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s, i) => (
          <span key={s.symbol}>
            <span className="font-semibold" style={{ color: compare ? LINE_COLORS[i] : undefined }}>
              {s.symbol}
            </span>{" "}
            {s.end.toFixed(2)} {s.currency} ·{" "}
            <span className={s.changePercent >= 0 ? "text-success" : "text-danger"}>
              {formatPercent(s.changePercent)}
            </span>{" "}
            <span className="text-muted">{RANGE_LABELS[range]}</span>
          </span>
        ))}
      </div>

      {series.length > 0 && (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              {/* Category axis spaces points evenly, so closed-market hours and
                  weekends don't show up as long flat stretches. */}
              <XAxis
                dataKey="t"
                type="category"
                tickFormatter={(t) => formatTime(Number(t))}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                stroke="var(--border)"
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={formatValue}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                stroke="var(--border)"
                width={compare ? 56 : 48}
              />
              <Tooltip
                labelFormatter={(t) => formatTime(Number(t))}
                formatter={(v) => formatValue(Number(v))}
                contentStyle={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--muted)" }}
              />
              {compare && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {series.map((s, i) => (
                <Line
                  key={s.symbol}
                  dataKey={s.symbol}
                  stroke={
                    compare
                      ? LINE_COLORS[i % LINE_COLORS.length]
                      : s.changePercent >= 0
                        ? "var(--success)"
                        : "var(--danger)"
                  }
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {errors.map((e) => (
        <p key={e.company} className="mt-1 text-xs text-muted">
          Couldn&apos;t load {e.company}: {e.message}
        </p>
      ))}
    </div>
  );
}
