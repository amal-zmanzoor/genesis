"use client";

import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/chat-tools";
import { EmailCard, type ApprovalResponder } from "./email-card";
import { StockChart, StockChartPlaceholder } from "./stock-chart";

const USER_BUBBLE_COLORS = [
  "bg-pastel-blue",
  "bg-pastel-mint",
  "bg-pastel-peach",
  "bg-pastel-pink",
];

const NAME = "Amal";

const ALT_GREETINGS = [
  `Welcome back, ${NAME}`,
  `What's on your mind, ${NAME}?`,
  `Ready when you are, ${NAME}`,
  "Ask me anything",
];

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return `Up late, ${NAME}?`;
  if (hour < 12) return `Good morning, ${NAME}!`;
  if (hour < 18) return `Good afternoon, ${NAME}!`;
  if (hour < 22) return `Good evening, ${NAME}!`;
  return `Up late, ${NAME}?`;
}

function pickGreeting() {
  return Math.random() < 0.5
    ? timeOfDayGreeting()
    : ALT_GREETINGS[Math.floor(Math.random() * ALT_GREETINGS.length)];
}

const MARKDOWN_CLASSES =
  "[&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold " +
  "[&_h1]:mb-2 [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold " +
  "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 " +
  "[&_code]:rounded [&_code]:bg-black/20 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs " +
  "[&_a]:underline [&_a]:text-accent";

function toolLabel(part: ChatMessage["parts"][number]) {
  if (part.type === "tool-web_search") {
    return part.state === "output-available" ? "🔎 Searched the web" : "🔎 Searching the web…";
  }
  if (part.type === "tool-getStockQuote") {
    const company = part.input?.company ?? "";
    if (part.state === "output-error") return `📈 Couldn't get a quote for ${company}`;
    if (part.state !== "output-available") return `📈 Looking up ${company}…`;
    const q = part.output;
    const sign = q.changePercent >= 0 ? "+" : "";
    return `📈 ${q.symbol} ${q.price.toFixed(2)} ${q.currency} (${sign}${q.changePercent.toFixed(2)}%)`;
  }
  if (part.type === "tool-getStockHistory" && part.state === "output-error") {
    return "📊 Couldn't load price history";
  }
  return null;
}

function AssistantPart({
  part,
  respond,
}: {
  part: ChatMessage["parts"][number];
  respond: ApprovalResponder;
}) {
  if (part.type === "tool-sendEmailToMe") return <EmailCard part={part} respond={respond} />;
  if (part.type === "text") {
    return <ReactMarkdown components={{ img: () => null }}>{part.text}</ReactMarkdown>;
  }
  if (part.type === "tool-getStockHistory") {
    if (part.state === "output-available") return <StockChart data={part.output} />;
    if (part.state !== "output-error") return <StockChartPlaceholder />;
  }
  const label = toolLabel(part);
  return label ? <p className="mb-2 text-xs text-muted">{label}</p> : null;
}

export default function Home() {
  const { messages, sendMessage, status, error, addToolApprovalResponse } = useChat<ChatMessage>({
    // After you click Send/Cancel on an email, continue the turn so the server
    // sends it (or the model acknowledges the cancel).
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const [input, setInput] = useState("");
  const [greeting] = useState(() => pickGreeting());
  const bottomRef = useRef<HTMLDivElement>(null);

  const isBusy = status === "submitted" || status === "streaming";

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  }

  let userMessageIndex = -1;

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Genesis</h1>
        <p className="text-sm text-muted">gpt-4o-mini · stocks, charts + web search</p>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-muted">
            <p className="animate-fade-in-up text-lg" suppressHydrationWarning>
              {greeting}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => {
              if (message.role === "user") userMessageIndex++;

              const bubbleColor =
                USER_BUBBLE_COLORS[userMessageIndex % USER_BUBBLE_COLORS.length];

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "user" ? (
                    <div
                      className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${bubbleColor} text-bubble-user-text`}
                    >
                      {message.parts
                        .map((part) => (part.type === "text" ? part.text : ""))
                        .join("")}
                    </div>
                  ) : (
                    <div
                      className={`${
                        message.parts.some((part) => part.type === "tool-getStockHistory")
                          ? "w-full"
                          : "max-w-[75%]"
                      } rounded-2xl bg-surface-raised px-4 py-2.5 text-sm text-bubble-assistant-text ${MARKDOWN_CLASSES}`}
                    >
                      {message.parts.map((part, i) => (
                        <AssistantPart key={i} part={part} respond={addToolApprovalResponse} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {status === "submitted" && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl bg-surface-raised px-4 py-2.5 text-sm text-muted">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl bg-pastel-pink px-4 py-2.5 text-sm text-bubble-user-text">
            {error.message || "Something went wrong. Check your OPENAI_API_KEY in .env.local."}
          </div>
        )}
      </main>

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-2 bg-background px-4 pt-4 pb-6"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Genesis…"
          className="flex-1 rounded-full border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
