"use client";

import type { ClientResult } from "@/lib/clientApi";
import { newId, type Msg } from "./SessionProvider";

/** Turns stored messages into API history: only real turns, never errors or summaries. */
export function toHistory(messages: Msg[]): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter((m) => !m.kind || m.kind === "normal")
    .map((m) => ({ role: m.role, content: m.content }));
}

export function resultToMessage(
  res: ClientResult<{ reply: string }>,
  kind: "normal" | "summary" = "normal",
): Msg {
  if (res.ok) return { id: newId(), role: "assistant", content: res.reply, kind };
  return {
    id: newId(),
    role: "assistant",
    content: "",
    kind: "error",
    errorCode: res.error,
    retryAfter: res.retryAfter,
  };
}

export function userMessage(content: string): Msg {
  return { id: newId(), role: "user", content, kind: "normal" };
}
