import { NextResponse } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";
import type { ApiErrorCode, ApiResponse } from "@/lib/api";
import { runWithGuard } from "@/lib/pipeline";
import { buildRecapMessages, formatTranscript, isMode, LIMITS, TEMPERATURE } from "@/lib/prompts";
import type { ChatMessage } from "@/lib/llm/types";
import { aiLimiter, clientIp } from "@/lib/rateLimit";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

export const runtime = "nodejs";
export const maxDuration = 60;

type RecapResponse = ApiResponse<{ recap: string }>;

const DOC_TITLE: Record<Locale, string> = { en: en.recap.docTitle, he: he.recap.docTitle };
const MODE_LABEL = { breakdown: "Break it down", narrator: "Code narrator", syntax: "Syntax help" } as const;

function error(code: ApiErrorCode, status: number, retryAfter?: number) {
  return NextResponse.json<RecapResponse>({ ok: false, error: code, retryAfter }, { status });
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
  const { locale } = body;
  if (!isLocale(locale) || !Array.isArray(body.transcript)) return error("bad_request", 400);

  // Group consecutive turns by mode so the summariser knows where each came from.
  const sections: string[] = [];
  let currentMode = "";
  let buffer: ChatMessage[] = [];
  const flush = () => {
    if (buffer.length) sections.push(`### ${MODE_LABEL[currentMode as keyof typeof MODE_LABEL]}\n${formatTranscript(buffer, Infinity)}`);
    buffer = [];
  };
  for (const item of body.transcript as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const { mode, role, content } = item as Record<string, unknown>;
    if (!isMode(mode) || (role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    if (mode !== currentMode) {
      flush();
      currentMode = mode;
    }
    buffer.push({ role, content: content.slice(0, LIMITS.messageChars) });
  }
  flush();

  let transcript = sections.join("\n\n");
  if (!transcript.trim()) return error("bad_request", 400);
  if (transcript.length > LIMITS.transcriptChars) transcript = transcript.slice(-LIMITS.transcriptChars);

  // INTEGRITY: the student's code is used ONLY for the guard's overlap check; it is never sent to the model.
  const studentCode = typeof body.studentCode === "string" ? body.studentCode.slice(0, LIMITS.codeChars * 4) : "";

  const result = await runWithGuard({
    task: "recap",
    messages: buildRecapMessages(locale, DOC_TITLE[locale], transcript),
    temperature: TEMPERATURE.recap,
    ctx: { studentCode },
  });

  if (!result.ok) return error(result.reason, result.reason === "unavailable" ? 503 : 200);
  return NextResponse.json<RecapResponse>({ ok: true, recap: result.text });
}
