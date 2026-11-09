import { getProviders, getTimeoutMs } from "./providers";
import {
  AllProvidersFailedError,
  type CompletionRequest,
  type CompletionResult,
  type ProviderConfig,
} from "./types";

export interface ClientOptions {
  providers?: ProviderConfig[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Some free models emit their reasoning inline; never show that to students. */
export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Calls the providers in order through their OpenAI-compatible
 * chat-completions endpoints, moving to the next one on any failure
 * (429, 5xx, timeout, network error, bad key, empty reply).
 * Logs contain only provider ids and status codes, never user text.
 */
export async function chatCompletion(
  req: CompletionRequest,
  opts: ClientOptions = {},
): Promise<CompletionResult> {
  const providers = opts.providers ?? getProviders();
  const timeoutMs = opts.timeoutMs ?? getTimeoutMs();
  const doFetch = opts.fetchImpl ?? fetch;
  const attempts: { provider: string; reason: string }[] = [];

  for (const p of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: p.model,
          messages: req.messages,
          temperature: req.temperature,
          // Generous because some free models spend tokens on hidden reasoning.
          max_tokens: req.maxTokens ?? 2000,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const reason = `http_${res.status}`;
        attempts.push({ provider: p.id, reason });
        console.warn(`[llm] provider=${p.id} failed reason=${reason}`);
        continue;
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null } }[];
      };
      const text = stripReasoning(data.choices?.[0]?.message?.content ?? "");
      if (!text) {
        attempts.push({ provider: p.id, reason: "empty" });
        console.warn(`[llm] provider=${p.id} failed reason=empty`);
        continue;
      }
      return { text, provider: p.id };
    } catch (err) {
      const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "network";
      attempts.push({ provider: p.id, reason });
      console.warn(`[llm] provider=${p.id} failed reason=${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new AllProvidersFailedError(attempts);
}
