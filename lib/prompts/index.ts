import { localeLanguageName, type Locale } from "@/i18n/config";
import type { ChatMessage } from "@/lib/llm/types";
import { withSharedRules } from "./shared";
import { BREAKDOWN_PROMPT, SUMMARY_PROMPT } from "./breakdown";
import { NARRATOR_PROMPT, narratorFirstMessage } from "./narrator";
import { SYNTAX_PROMPT } from "./syntax";
import { recapPrompt } from "./recap";

import { type Mode, type Task } from "@/lib/modes";
export { MODES, isMode, type Mode, type Task } from "@/lib/modes";

/** Context limits that keep us inside free-tier token budgets. */
export const LIMITS = {
  historyMessages: 10,
  messageChars: 4000,
  /** Total characters of history sent per request (oldest turns are dropped first). */
  historyChars: 12000,
  /** Summary sees more turns, but within its own budget. */
  summaryMessages: 30,
  summaryChars: 16000,
  codeChars: 8000,
  outputChars: 4000,
  transcriptChars: 12000,
} as const;

export const TEMPERATURE: Record<Task, number> = {
  breakdown: 0.5,
  narrator: 0.3,
  syntax: 0.3,
  summary: 0.3,
  recap: 0.3,
};

const MODE_PROMPTS: Record<Mode, string> = {
  breakdown: BREAKDOWN_PROMPT,
  narrator: NARRATOR_PROMPT,
  syntax: SYNTAX_PROMPT,
};

/**
 * Keep only user/assistant turns (never trust a client-sent system role), then
 * trim to the last `maxMessages` turns and to a total character budget, so one
 * request can't use up the shared free-tier token quota.
 */
export function sanitizeHistory(
  history: unknown,
  maxMessages: number = LIMITS.historyMessages,
  maxChars: number = LIMITS.historyChars,
): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  const clean: ChatMessage[] = [];
  for (const m of history) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim();
    if (!text) continue;
    clean.push({ role, content: text.slice(0, LIMITS.messageChars) });
  }
  const recent = clean.slice(-maxMessages);
  let total = recent.reduce((n, m) => n + m.content.length, 0);
  // Drop oldest turns until within budget, but always keep the latest message.
  while (total > maxChars && recent.length > 1) total -= recent.shift()!.content.length;
  return recent;
}

export interface BuildInput {
  mode: Mode;
  locale: Locale;
  history: ChatMessage[];
  code?: string;
  output?: string;
}

export function buildChatMessages({ mode, locale, history, code, output }: BuildInput): ChatMessage[] {
  const system = withSharedRules(MODE_PROMPTS[mode], localeLanguageName[locale]);
  const msgs: ChatMessage[] = [{ role: "system", content: system }];
  if (mode === "narrator" && code) {
    // The code message is always kept, even when follow-ups are trimmed.
    msgs.push({ role: "user", content: narratorFirstMessage(code, output) });
  }
  msgs.push(...history);
  return msgs;
}

export function buildSummaryMessages(locale: Locale, history: ChatMessage[]): ChatMessage[] {
  const transcript = formatTranscript(history);
  return [
    { role: "system", content: withSharedRules(SUMMARY_PROMPT, localeLanguageName[locale]) },
    { role: "user", content: `Conversation:\n<transcript>\n${transcript}\n</transcript>\n\nSummarise my thinking.` },
  ];
}

export function buildRecapMessages(
  locale: Locale,
  title: string,
  transcript: string,
  hasBreakdown: boolean,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: withSharedRules(recapPrompt(localeLanguageName[locale], title, hasBreakdown), localeLanguageName[locale]),
    },
    { role: "user", content: `Session transcript:\n<transcript>\n${transcript}\n</transcript>` },
  ];
}

export function formatTranscript(history: ChatMessage[], maxChars: number = LIMITS.transcriptChars): string {
  const text = history
    .map((m) => `${m.role === "user" ? "Student" : "Companion"}: ${m.content}`)
    .join("\n\n");
  // Keep the most recent part if too long.
  return text.length > maxChars ? text.slice(-maxChars) : text;
}
