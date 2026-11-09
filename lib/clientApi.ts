"use client";

import type { ApiErrorCode, ApiResponse, ChatRequestBody, RecapRequestBody } from "./api";

export type ClientResult<T> = ({ ok: true } & T) | { ok: false; error: ApiErrorCode | "network"; retryAfter?: number };

async function post<T>(url: string, body: unknown): Promise<ClientResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as ApiResponse<T> | null;
    if (!data) return { ok: false, error: res.status === 429 ? "rate_limited" : "unavailable" };
    return data;
  } catch {
    return { ok: false, error: "network" };
  }
}

export const requestChat = (body: ChatRequestBody) => post<{ reply: string }>("/api/chat", body);
export const requestRecap = (body: RecapRequestBody) => post<{ recap: string }>("/api/recap", body);
