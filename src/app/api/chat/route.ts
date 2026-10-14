import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import { chatTools, type ChatMessage } from "@/lib/chat-tools";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system:
      `You are a helpful, concise assistant. Today is ${new Date().toDateString()}. ` +
      "For stock tools, pass company names exactly as the user wrote them; the tools look up " +
      "the ticker. If a tool says a company isn't publicly traded, tell the user that rather " +
      "than trying a different company. " +
      "Use getStockHistory for trends, performance over time, or comparisons; it is shown to " +
      "the user as a chart that already displays each stock's price and % change. After it, " +
      "write 2–3 plain sentences of insight (e.g. which did best, notable highs/lows) using " +
      "the numbers it returns. No headings, bullet lists, images or links to charts. " +
      "Use web_search for recent news or anything you don't know. " +
      "When the user asks you to email them something, call sendEmailToMe with the complete " +
      "content (gather any data you need first). The user confirms before it is sent. If " +
      "they cancel, reply with one short sentence like \"OK, I won't send it.\" — don't " +
      "repeat the content or retry. If sending fails, tell them the error message.",
    messages: await convertToModelMessages(messages),
    tools: chatTools,
    stopWhen: isStepCount(6),
    toolApproval: { sendEmailToMe: "user-approval" },
    // Signs each approval request so a tampered client can't fake a "Send" click.
    experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET,
  });

  return result.toUIMessageStreamResponse({
    // The SDK hides error details by default; ours are user-facing messages
    // like "Email isn't set up…", so pass them through.
    onError: (error) => (error instanceof Error ? error.message : "Something went wrong"),
  });
}
