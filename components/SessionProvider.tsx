"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Mode } from "@/lib/modes";

/**
 * All session state lives in this tab only: React state mirrored to
 * sessionStorage so it survives a language switch or reload, and disappears
 * when the tab closes. No accounts, no database.
 */

export type MessageKind = "normal" | "summary" | "error";

export interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** "summary" and "error" messages are shown but never sent back to the model. */
  kind?: MessageKind;
  /** For errors: the localized-message key under `errors.*`. */
  errorCode?: string;
  retryAfter?: number;
}

export interface SessionState {
  activeMode: Mode;
  breakdown: { messages: Msg[] };
  narrator: {
    code: string;
    output: string;
    /** Set once the student submits; the narration and follow-ups refer to this. */
    submitted: { code: string; output: string } | null;
    messages: Msg[];
    /** Every code snippet submitted this session. Used only for the recap's overlap check. */
    allCode: string[];
  };
  syntax: { messages: Msg[] };
}

const STORAGE_KEY = "ptp-session-v1";

export const initialSession: SessionState = {
  activeMode: "breakdown",
  breakdown: { messages: [] },
  narrator: { code: "", output: "", submitted: null, messages: [], allCode: [] },
  syntax: { messages: [] },
};

interface SessionContextValue {
  state: SessionState;
  update: (fn: (s: SessionState) => SessionState) => void;
  setMode: (mode: Mode) => void;
  reset: () => void;
  hasContent: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function load(): SessionState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    return { ...initialSession, ...parsed, narrator: { ...initialSession.narrator, ...parsed.narrator } };
  } catch {
    return null;
  }
}

function save(state: SessionState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: the session still works, it just won't survive a reload.
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialSession);
  const loaded = useRef(false);

  useEffect(() => {
    const stored = load();
    if (stored) setState(stored);
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (loaded.current) save(state);
  }, [state]);

  const update = useCallback((fn: (s: SessionState) => SessionState) => setState(fn), []);
  const setMode = useCallback((mode: Mode) => setState((s) => ({ ...s, activeMode: mode })), []);
  const reset = useCallback(() => {
    setState((s) => ({ ...initialSession, activeMode: s.activeMode }));
  }, []);

  const hasContent =
    state.breakdown.messages.some((m) => m.role === "user") ||
    state.narrator.messages.some((m) => m.role === "assistant" && m.kind !== "error") ||
    state.syntax.messages.some((m) => m.role === "assistant" && m.kind !== "error");

  const value = useMemo(
    () => ({ state, update, setMode, reset, hasContent }),
    [state, update, setMode, reset, hasContent],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}
