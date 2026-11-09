export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ProviderConfig {
  /** Short id used in LLM_PROVIDER_ORDER and logs, e.g. "groq". */
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  provider: string;
}

/** Thrown when every configured provider failed (or none is configured). */
export class AllProvidersFailedError extends Error {
  constructor(public readonly attempts: { provider: string; reason: string }[]) {
    super(
      attempts.length === 0
        ? "No LLM provider is configured"
        : `All LLM providers failed: ${attempts.map((a) => `${a.provider}(${a.reason})`).join(", ")}`,
    );
    this.name = "AllProvidersFailedError";
  }
}
