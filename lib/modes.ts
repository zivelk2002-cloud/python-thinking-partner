/**
 * Mode names, safe to import from client components.
 * INTEGRITY: keep this file free of prompt or guard imports. Client code must
 * never import lib/prompts, lib/guard*, lib/llm or lib/pipeline (enforced by
 * ESLint in eslint.config.mjs), so prompts and guard lists never ship to browsers.
 */
export const MODES = ["breakdown", "narrator", "syntax"] as const;
export type Mode = (typeof MODES)[number];

/** A guard/prompt "task": the three chat modes plus the two one-shot tasks. */
export type Task = Mode | "summary" | "recap";

export function isMode(v: unknown): v is Mode {
  return typeof v === "string" && (MODES as readonly string[]).includes(v);
}
