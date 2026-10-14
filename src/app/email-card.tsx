"use client";

import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "@/lib/chat-tools";

type EmailPart = ChatMessage["parts"][number] & { type: "tool-sendEmailToMe" };

export type ApprovalResponder = (response: { id: string; approved: boolean; reason?: string }) => void;

export function EmailCard({ part, respond }: { part: EmailPart; respond: ApprovalResponder }) {
  if (part.state === "input-streaming") {
    return <p className="mb-2 text-xs text-muted">✉️ Drafting email…</p>;
  }

  const status =
    part.state === "approval-requested"
      ? null
      : part.state === "output-available"
        ? `✉️ Sent to ${part.output.to}`
        : part.state === "output-denied" ||
            (part.state === "approval-responded" && !part.approval.approved)
          ? "✉️ Cancelled — not sent"
          : part.state === "output-error"
            ? `✉️ Couldn't send: ${part.errorText}`
            : "✉️ Sending…";

  return (
    <div className="mb-2 rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-muted">Email to you</p>
      <p className="mb-2 font-semibold">{part.input?.subject}</p>
      <div className="mb-3 max-h-60 overflow-y-auto rounded-lg bg-background/60 p-3 text-xs">
        <ReactMarkdown components={{ img: () => null }}>{part.input?.body ?? ""}</ReactMarkdown>
      </div>

      {part.state === "approval-requested" ? (
        <div className="flex gap-2">
          <button
            onClick={() => respond({ id: part.approval.id, approved: true })}
            className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Send
          </button>
          <button
            onClick={() =>
              respond({
                id: part.approval.id,
                approved: false,
                reason: "The user clicked Cancel because they decided not to send this email. Nothing is wrong with email.",
              })
            }
            className="rounded-full border border-border px-4 py-1.5 text-xs text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">{status}</p>
      )}
    </div>
  );
}
