import { describe, expect, it, vi } from "vitest";
import { chatCompletion, stripReasoning } from "@/lib/llm/client";
import { getProviders } from "@/lib/llm/providers";
import { AllProvidersFailedError, type ProviderConfig } from "@/lib/llm/types";

const providers: ProviderConfig[] = [
  { id: "a", baseUrl: "https://a.test/v1", apiKey: "ka", model: "ma" },
  { id: "b", baseUrl: "https://b.test/v1", apiKey: "kb", model: "mb" },
];

function ok(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

const req = { messages: [{ role: "user" as const, content: "hi" }], temperature: 0.3 };

describe("getProviders", () => {
  it("respects order and skips providers without key or model", () => {
    const list = getProviders({
      LLM_PROVIDER_ORDER: "openrouter, groq, gemini",
      GROQ_API_KEY: "g",
      GROQ_MODEL: "gm",
      GEMINI_API_KEY: "x", // no model -> skipped
      OPENROUTER_API_KEY: "o",
      OPENROUTER_MODEL: "om",
    });
    expect(list.map((p) => p.id)).toEqual(["openrouter", "groq"]);
    expect(list[1].baseUrl).toBe("https://api.groq.com/openai/v1");
  });

  it("strips quotes and whitespace pasted around values", () => {
    const [p] = getProviders({
      LLM_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: ' "gsk_abc" ',
      GROQ_MODEL: "'openai/gpt-oss-120b'",
    });
    expect(p.apiKey).toBe("gsk_abc");
    expect(p.model).toBe("openai/gpt-oss-120b");
  });

  it("allows overriding base URL and strips trailing slash", () => {
    const [p] = getProviders({
      LLM_PROVIDER_ORDER: "groq",
      GROQ_API_KEY: "g",
      GROQ_MODEL: "gm",
      GROQ_BASE_URL: "https://proxy.test/v1/",
    });
    expect(p.baseUrl).toBe("https://proxy.test/v1");
  });
});

describe("chatCompletion", () => {
  it("returns the first provider's reply", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok("hello"));
    const res = await chatCompletion(req, { providers, fetchImpl });
    expect(res).toEqual({ text: "hello", provider: "a" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://a.test/v1/chat/completions");
    expect(JSON.parse(init.body).model).toBe("ma");
  });

  it("falls back on 429 and 5xx", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(ok("from b"));
    const res = await chatCompletion(req, { providers, fetchImpl });
    expect(res.provider).toBe("b");
  });

  it("falls back on timeout", async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );
    fetchImpl.mockResolvedValueOnce(ok("late but fine"));
    const res = await chatCompletion(req, { providers, fetchImpl, timeoutMs: 10 });
    expect(res.text).toBe("late but fine");
  });

  it("throws AllProvidersFailedError when everything fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    await expect(chatCompletion(req, { providers, fetchImpl })).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
  });

  it("throws when no provider is configured", async () => {
    await expect(chatCompletion(req, { providers: [] })).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
  });

  it("strips inline reasoning", () => {
    expect(stripReasoning("<think>secret plan</think>\nAnswer")).toBe("Answer");
  });
});
