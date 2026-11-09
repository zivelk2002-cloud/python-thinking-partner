import { checkReply, logRejection, RULE_DESCRIPTIONS, type GuardContext } from "@/lib/guard";
import { chatCompletion } from "@/lib/llm/client";
import { AllProvidersFailedError, type ChatMessage, type CompletionRequest, type CompletionResult } from "@/lib/llm/types";
import type { Task } from "@/lib/prompts";

export type PipelineResult =
  | { ok: true; text: string }
  | { ok: false; reason: "guard_blocked" | "unavailable" };

export interface PipelineInput {
  task: Task;
  messages: ChatMessage[];
  temperature: number;
  ctx?: GuardContext;
  /** Injected in tests. */
  complete?: (req: CompletionRequest) => Promise<CompletionResult>;
}

/**
 * call model → guard → (on reject) retry once with a stricter reminder → guard
 * → (on reject again) safe fallback. The client shows a localized message for
 * each failure reason, so no rejected text ever reaches the student.
 */
export async function runWithGuard({
  task,
  messages,
  temperature,
  ctx = {},
  complete = (req) => chatCompletion(req),
}: PipelineInput): Promise<PipelineResult> {
  try {
    const first = await complete({ messages, temperature });
    const check1 = checkReply(task, first.text, ctx);
    if (check1.ok) return { ok: true, text: first.text };
    logRejection(task, check1.rule, 1, first.text);

    // The reminder goes in a user-role message because some OpenAI-compatible
    // endpoints don't accept a system message after the conversation starts.
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: first.text },
      {
        role: "user",
        content: `[Automatic check, not from the student] Your previous reply broke a rule: ${RULE_DESCRIPTIONS[check1.rule]}. Reply again to the student's last message without breaking it, following all your rules.`,
      },
    ];
    const second = await complete({ messages: retryMessages, temperature: Math.max(0, temperature - 0.2) });
    const check2 = checkReply(task, second.text, ctx);
    if (check2.ok) return { ok: true, text: second.text };
    logRejection(task, check2.rule, 2, second.text);
    return { ok: false, reason: "guard_blocked" };
  } catch (err) {
    if (err instanceof AllProvidersFailedError) return { ok: false, reason: "unavailable" };
    console.error("[pipeline] unexpected error", err instanceof Error ? err.name : "unknown");
    return { ok: false, reason: "unavailable" };
  }
}
