# Genesis

A personal AI chat assistant built with Next.js and the Vercel AI SDK. Besides general chat, it can look up live stock prices, draw interactive price charts, search the web, and email things to you, with a confirmation step before anything is sent.
<img width="1424" height="747" alt="image" src="https://github.com/user-attachments/assets/703d9aea-ad3a-498e-9e3c-e4f69c15aebb" />


## Features

- **Chat**: streaming replies from OpenAI `gpt-4o-mini`, rendered as Markdown.
- **Stock quotes**: ask "how is Nvidia doing today?" for the latest price and daily change. Company names are converted to tickers on the server, so the model never guesses a ticker. Companies that aren't listed (e.g. Bloomberg) are reported as not publicly traded.
- **Price charts**: ask "compare Apple, Google and Nvidia year to date" for an interactive chart in the reply. One stock is plotted as price; several are plotted as % change so they can be compared. Ranges: 1d, 5d, 1mo, 6mo, ytd, 1y, 5y.
- **Web search**: recent news and anything the model doesn't know, via OpenAI's built-in web search.
- **Email to yourself**: ask "email me a summary of Apple this month". The chat shows the subject and content with **Send** and **Cancel** buttons, and nothing goes out until you click Send. The recipient is fixed in config, so the assistant can only ever email you.

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure `.env.local`

Create a `.env.local` file in the project root. It's ignored by git, so never commit it.

```bash
# Required
OPENAI_API_KEY=sk-...

# Signs email Send/Cancel approvals. Any long random string, e.g. from:
#   openssl rand -base64 32
TOOL_APPROVAL_SECRET=...

# Email (optional; needed only for the email feature)
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop   # 16-letter Gmail App Password
# EMAIL_TO=other@example.com          # optional; defaults to GMAIL_USER
```

**Gmail App Password**: turn on 2-Step Verification for your Google account, then create one at <https://myaccount.google.com/apppasswords>. It's separate from your normal password, which stays unchanged. Treat it like a real password: it gives full access to your account. Delete it on the same page to revoke it.

### 3. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## How it works

```
Browser (useChat)  ──►  POST /api/chat  ──►  streamText(gpt-4o-mini, tools)
      ▲                                              │
      └──── streamed text + tool results ◄───────────┘
```

The model decides when to call tools. The server runs them and streams the results back, and the UI renders each kind of result in its own way (chart, status line or email card).

| Tool | What it does | Data source |
| --- | --- | --- |
| `getStockQuote` | Latest price and daily change | Yahoo Finance (public, no key) |
| `getStockHistory` | Price history for up to 5 companies, rendered as a chart | Yahoo Finance |
| `web_search` | Web search | OpenAI (uses your OpenAI key) |
| `sendEmailToMe` | Emails you; requires approval in the UI | Gmail SMTP |

**Safety**

- Yahoo Finance responses are validated with zod, so an unexpected format produces a clear error instead of wrong numbers.
- Email approvals are HMAC-signed (`TOOL_APPROVAL_SECRET`), so a modified client can't fake a Send click.

## Project structure

```
src/
├── app/
│   ├── api/chat/route.ts   # Chat endpoint: model, system prompt, tools, approval rules
│   ├── page.tsx            # Chat UI and message rendering
│   ├── stock-chart.tsx     # Recharts price chart
│   ├── email-card.tsx      # Email preview with Send/Cancel
│   └── globals.css         # Theme colours (Tailwind v4)
└── lib/
    ├── chat-tools.ts       # Registry of all tools and the typed ChatMessage
    ├── stock-tools.ts      # Yahoo Finance fetching, ticker lookup, quote/history tools
    └── email-tool.ts       # Gmail SMTP email tool
```

**Adding a tool:** define it with `tool()` from `ai` in `src/lib/`, then add it to `chatTools` in `chat-tools.ts`. The UI gets its input and output types automatically. Render it in `AssistantPart` in `page.tsx`.

## Tech stack

Next.js 16 (App Router) · React 19 · Vercel AI SDK 7 · OpenAI · Tailwind CSS 4 · Recharts · zod · Nodemailer

## Limitations

- Yahoo Finance's endpoints are unofficial and could change or start rate-limiting.
- Emails are plain text and don't include charts yet.
- Chats aren't saved: refreshing the page starts a new conversation.
