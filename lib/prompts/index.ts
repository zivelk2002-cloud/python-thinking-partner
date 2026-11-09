import { localeLanguageName, type Locale } from "@/i18n/config";
import type { ChatMessage } from "@/lib/llm/types";
import { withSharedRules } from "./shared";
import { BREAKDOWN_PROMPT, SUMMARY_PROMPT } from "./breakdown";
import { NARRATOR_PROMPT, narratorFirstMessage } from "./narrator";
import { SYNTAX_PROMPT } from "./syntax";
import { recapPrompt } from "./recap";

export const MODES = ["breakdown", "narrator", "syntax"] as const;
export type Mode = (typeof MODES)[number];

/** A guard/prompt "task": the three chat modes plus the two one-shot tasks. */
export type Task = Mode | "summary" | "recap";

export function isMode(v: unknown): v is Mode {
  return typeof v === "string" && (MODES as readonly string[]).includes(v);
}

/** Context limits that keep us inside free-tier token budgets. */
export const LIMITS = {
  historyMessages: 10,
  messageChars: 4000,
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

/** Keep only user/assistant turns (never trust a client-sent system role) and trim. */
export function sanitizeHistory(history: unknown, maxMessages: number = LIMITS.historyMessages): ChatMessage[] {
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
  return clean.slice(-maxMessages);
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

export function buildRecapMessages(locale: Locale, title: string, transcript: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: withSharedRules(recapPrompt(localeLanguageName[locale], title), localeLanguageName[locale]),
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
