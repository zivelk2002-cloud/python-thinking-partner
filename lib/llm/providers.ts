import type { ProviderConfig } from "./types";

/**
 * Known providers. Only base URLs have defaults here; model names come
 * exclusively from env vars because free-tier model IDs change often.
 */
const KNOWN: Record<string, { envPrefix: string; defaultBaseUrl: string }> = {
  groq: { envPrefix: "GROQ", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  gemini: {
    envPrefix: "GEMINI",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  openrouter: { envPrefix: "OPENROUTER", defaultBaseUrl: "https://openrouter.ai/api/v1" },
};

const DEFAULT_ORDER = "groq,gemini,openrouter";

type Env = Record<string, string | undefined>;

/** Returns the usable providers, in fallback order. Providers missing a key or model are skipped. */
export function getProviders(env: Env = process.env): ProviderConfig[] {
  const order = (env.LLM_PROVIDER_ORDER || DEFAULT_ORDER)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const result: ProviderConfig[] = [];
  for (const id of order) {
    const known = KNOWN[id];
    if (!known) {
      console.warn(`[llm] unknown provider "${id}" in LLM_PROVIDER_ORDER, skipping`);
      continue;
    }
    const apiKey = env[`${known.envPrefix}_API_KEY`]?.trim();
    const model = env[`${known.envPrefix}_MODEL`]?.trim();
    if (!apiKey || !model) continue;
    const baseUrl = (env[`${known.envPrefix}_BASE_URL`]?.trim() || known.defaultBaseUrl).replace(
      /\/+$/,
      "",
    );
    result.push({ id, baseUrl, apiKey, model });
  }
  return result;
}

export function getTimeoutMs(env: Env = process.env): number {
  const n = Number(env.LLM_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25_000;
}
