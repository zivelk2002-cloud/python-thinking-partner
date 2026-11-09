import { NextResponse } from "next/server";
import { isLocale } from "@/i18n/config";
import type { ApiErrorCode, ApiResponse } from "@/lib/api";
import { runWithGuard } from "@/lib/pipeline";
import {
  buildChatMessages,
  buildSummaryMessages,
  isMode,
  LIMITS,
  sanitizeHistory,
  TEMPERATURE,
} from "@/lib/prompts";
import { aiLimiter, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatResponse = ApiResponse<{ reply: string }>;

function error(code: ApiErrorCode, status: number, retryAfter?: number) {
  return NextResponse.json<ChatResponse>({ ok: false, error: code, retryAfter }, { status });
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

  // Summary needs the whole Mode 1 conversation, so allow more history there.
  const history = sanitizeHistory(rawMessages, action === "summary" ? 40 : LIMITS.historyMessages);
  if (mode !== "narrator" && !history.some((m) => m.role === "user")) return error("bad_request", 400);

  const studentText = history.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const userMessage = [...history].reverse().find((m) => m.role === "user")?.content;

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
