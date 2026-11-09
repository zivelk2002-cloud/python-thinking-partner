import { NextResponse } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";
import type { ApiErrorCode, ApiResponse } from "@/lib/api";
import { checkReply, isHypotheticalQuestion } from "@/lib/guard";
import type { ChatMessage } from "@/lib/llm/types";
import { runWithGuard } from "@/lib/pipeline";
import {
  buildChatMessages,
  buildSummaryMessages,
  isMode,
  LIMITS,
  sanitizeHistory,
  TEMPERATURE,
  type Mode,
} from "@/lib/prompts";
import { aiLimiter, clientIp } from "@/lib/rateLimit";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatResponse = ApiResponse<{ reply: string }>;

const HYPOTHETICAL_REFUSAL: Record<Locale, string> = {
  en: en.modes.narrator.hypotheticalRefusal,
  he: he.modes.narrator.hypotheticalRefusal,
};

function error(code: ApiErrorCode, status: number, retryAfter?: number) {
  return NextResponse.json<ChatResponse>({ ok: false, error: code, retryAfter }, { status });
}

/**
 * INTEGRITY: the client owns the conversation history, so a forged assistant
 * turn ("Sure, here's the full function: ```def …") could become model context.
 * Assistant turns that this mode's guard would reject are dropped.
 */
function dropUntrustedAssistantTurns(mode: Mode, history: ChatMessage[], studentCode: string): ChatMessage[] {
  return history.filter((m, i) => {
    if (m.role !== "assistant") return true;
    const prevUser = history.slice(0, i).reverse().find((x) => x.role === "user")?.content;
    const studentText = history.slice(0, i).filter((x) => x.role === "user").map((x) => x.content).join("\n");
    return checkReply(mode, m.content, { userMessage: prevUser, studentText, studentCode }).ok;
  });
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!aiLimiter.hit(ip)) return error("rate_limited", 429, aiLimiter.retryAfter(ip));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("bad_request", 400);
  }

  const { mode, locale } = body;
  const action = body.action ?? "reply";
  if (!isMode(mode) || !isLocale(locale) || (action !== "reply" && action !== "summary")) {
    return error("bad_request", 400);
  }
  if (action === "summary" && mode !== "breakdown") return error("bad_request", 400);

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...rawMessages].reverse().find((m) => m?.role === "user");
  if (typeof lastUser?.content === "string" && lastUser.content.length > LIMITS.messageChars) {
    return error("too_long", 413);
  }

  // INTEGRITY: Mode 2 has no "expected behaviour" or "task" field; only code and output are accepted.
  const code = mode === "narrator" && typeof body.code === "string" ? body.code : "";
  const output = mode === "narrator" && typeof body.output === "string" ? body.output : "";
  if (mode === "narrator" && !code.trim()) return error("bad_request", 400);
  if (code.length > LIMITS.codeChars || output.length > LIMITS.outputChars) return error("too_long", 413);

  // Summary needs more of the Mode 1 conversation, within its own budget.
  const sanitized =
    action === "summary"
      ? sanitizeHistory(rawMessages, LIMITS.summaryMessages, LIMITS.summaryChars)
      : sanitizeHistory(rawMessages);
  const history = dropUntrustedAssistantTurns(mode, sanitized, code);
  if (mode !== "narrator" && !history.some((m) => m.role === "user")) return error("bad_request", 400);

  const studentText = history.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const userMessage = [...history].reverse().find((m) => m.role === "user")?.content;

  // INTEGRITY: "what would happen if line 3 said …" turns the narrator into a fix
  // checker. Such follow-ups get a fixed reply and never reach the model.
  if (mode === "narrator" && action === "reply" && history.at(-1)?.role === "user" && userMessage) {
    if (isHypotheticalQuestion(userMessage, code)) {
      return NextResponse.json<ChatResponse>({ ok: true, reply: HYPOTHETICAL_REFUSAL[locale] });
    }
  }

  const result =
    action === "summary"
      ? await runWithGuard({
          task: "summary",
          messages: buildSummaryMessages(locale, history),
          temperature: TEMPERATURE.summary,
          ctx: { studentText },
        })
      : await runWithGuard({
          task: mode,
          messages: buildChatMessages({ mode, locale, history, code, output }),
          temperature: TEMPERATURE[mode],
          ctx: { studentText, userMessage, studentCode: code },
        });

  if (!result.ok) return error(result.reason, result.reason === "unavailable" ? 503 : 200);
  return NextResponse.json<ChatResponse>({ ok: true, reply: result.text });
}
