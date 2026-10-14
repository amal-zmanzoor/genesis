import { tool } from "ai";
import nodemailer from "nodemailer";
import { z } from "zod";

// The recipient is fixed in server config, never chosen by the model, so this
// tool can only ever email you.
function getMailConfig() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Email isn't set up: add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local");
  }
  return { user, pass, to: process.env.EMAIL_TO || user };
}

export const sendEmailToMe = tool({
  description:
    "Email something to the user (only to them; you cannot choose the recipient). " +
    "Use only when the user asks to be emailed. The user reviews and confirms before it is sent. " +
    "Write the body as plain text with simple Markdown (paragraphs, bullet lists).",
  inputSchema: z.object({
    subject: z.string().min(1).max(200).describe("A short, specific subject line"),
    body: z.string().min(1).max(20000).describe("The full email content"),
  }),
  execute: async ({ subject, body }) => {
    const { user, pass, to } = getMailConfig();
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    const info = await transporter.sendMail({
      from: `Genesis <${user}>`,
      to,
      subject,
      text: body,
    });
    return { sent: true, to, messageId: info.messageId };
  },
});
