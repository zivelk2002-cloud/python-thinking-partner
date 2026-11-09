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

  // Tolerate values pasted with surrounding quotes or whitespace (common in hosting dashboards).
  const read = (name: string) => env[name]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();

  const result: ProviderConfig[] = [];
  const skipped: string[] = [];
  for (const id of order) {
    const known = KNOWN[id];
    if (!known) {
      console.warn(`[llm] unknown provider "${id}" in LLM_PROVIDER_ORDER, skipping`);
      continue;
    }
    const apiKey = read(`${known.envPrefix}_API_KEY`);
    const model = read(`${known.envPrefix}_MODEL`);
    if (!apiKey || !model) {
      // A model without a key is the default .env.example setup, so only a key without a model is worth a warning.
      if (apiKey && !model) skipped.push(`${id} (missing MODEL)`);
      continue;
    }
    const baseUrl = (read(`${known.envPrefix}_BASE_URL`) || known.defaultBaseUrl).replace(/\/+$/, "");
    result.push({ id, baseUrl, apiKey, model });
  }
  if (skipped.length) console.warn(`[llm] incomplete provider config: ${skipped.join(", ")}`);
  if (result.length === 0) {
    console.error("[llm] no LLM provider configured: set at least one *_API_KEY and *_MODEL env var");
  }
  return result;
}

export function getTimeoutMs(env: Env = process.env): number {
  const n = Number(env.LLM_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25_000;
}
