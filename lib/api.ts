/** Shared request/response shapes for the API routes and the client. */

export type ApiErrorCode =
  | "bad_request"
  | "too_long"
  | "rate_limited"
  | "guard_blocked"
  | "unavailable";

export type ApiResponse<T> = ({ ok: true } & T) | { ok: false; error: ApiErrorCode; retryAfter?: number };

export interface ChatRequestBody {
  mode: "breakdown" | "narrator" | "syntax";
  /** "reply" (default) continues the chat; "summary" is Mode 1's summarise button. */
  action?: "reply" | "summary";
  locale: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** Mode 2 only. */
  code?: string;
  output?: string;
}

export interface RecapRequestBody {
  locale: string;
  /** Conversation turns from all modes, oldest first. Never the raw Mode 2 code. */
  transcript: { mode: string; role: "user" | "assistant"; content: string }[];
  /** INTEGRITY: used only for the guard's overlap check, never sent to the model. */
  studentCode?: string;
}
