import { openai } from "@ai-sdk/openai";
import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import { sendEmailToMe } from "./email-tool";
import { getStockHistory, getStockQuote } from "./stock-tools";

export const chatTools = {
  getStockQuote,
  getStockHistory,
  sendEmailToMe,
  web_search: openai.tools.webSearch(),
};

export type ChatMessage = UIMessage<unknown, UIDataTypes, InferUITools<typeof chatTools>>;
