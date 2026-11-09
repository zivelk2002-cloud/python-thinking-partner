/**
 * Output guard: runs server-side on every model reply before it is shown.
 * Free models sometimes ignore system prompts; this is the second line of
 * defence. INTEGRITY: when a check is ambiguous, it rejects. A rejected
 * reply is retried once and then replaced by a safe fallback message.
 */
import type { Task } from "@/lib/prompts";
import { APPROACH_PHRASES, FIX_LANGUAGE, TECHNIQUE_TERMS, WRITE_REQUEST } from "./guard-words";

export type GuardRule =
  | "code_block"
  | "indented_code"
  | "inline_code_statement"
  | "fix_language"
  | "multiple_questions"
  | "approach_suggestion"
  | "too_many_blocks"
  | "block_too_long"
  | "task_function"
  | "copied_student_code";

export type GuardResult = { ok: true } | { ok: false; rule: GuardRule };

export interface GuardContext {
  /** The student's latest message (Mode 3 "write a function" check). */
  userMessage?: string;
  /** Everything the student wrote in this conversation (Mode 1 technique check). */
  studentText?: string;
  /** The student's Mode 2 code input(s) (narrator inline check, recap overlap check). */
  studentCode?: string;
}

export const LIMITS = {
  syntaxMaxBlocks: 2,
  recapMaxBlocks: 6,
  maxBlockLines: 10,
  /** Student code lines shorter than this (whitespace removed) are too generic to count as copied. */
  minCopiedLineChars: 12,
};

/** Short English description of each rule, used in the retry reminder. */
export const RULE_DESCRIPTIONS: Record<GuardRule, string> = {
  code_block: "it contained a code block. This mode allows no code blocks at all",
  indented_code: "it contained lines of code. This mode allows no code at all",
  inline_code_statement: "it contained a line of code. This mode allows no code at all",
  fix_language:
    "it used fix or judgement language (like should, instead, fix, wrong, replace). Describe only what the code does, neutrally",
  multiple_questions: "it asked more than one question. Ask exactly ONE question",
  approach_suggestion:
    "it suggested an approach, technique, or function the student did not mention. Only build on the student's own ideas",
  too_many_blocks: "it had too many code blocks. Use at most 2 tiny examples",
  block_too_long: "a code example was too long. Keep each example to at most 8 lines",
  task_function:
    "it wrote a function for the student's task. Do not write task code; explain the language features with unrelated toy examples and no `def`",
  copied_student_code:
    "it included the student's own code. The recap must contain no lines from the student's code",
};

// ─── helpers ──────────────────────────────────────────────────────────

const FENCE_RE = /(^|\n)[ \t]*(```|~~~)[^\n]*\n?([\s\S]*?)(\n[ \t]*\2[ \t]*(?=\n|$)|$)/g;

/** Returns the contents of fenced code blocks (unterminated fences count too). */
export function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (const m of text.matchAll(FENCE_RE)) blocks.push(m[3] ?? "");
  return blocks;
}

function stripCodeBlocks(text: string): string {
  return text.replace(FENCE_RE, "$1");
}

function stripInlineCode(text: string): string {
  return text.replace(/`[^`\n]*`/g, " ");
}

function inlineCodeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

const CODE_LINE_RE =
  /^(def|for|while|if|elif|else|return|print|import|from|class|try|except|with|lambda)\b|[=(\[{]|:\s*$/;
const LIST_MARKER_RE = /^([-*+•]|\d+[.)])\s/;

/** Two or more consecutive lines indented by 4+ spaces or a tab that look like code. */
export function hasIndentedCode(text: string): boolean {
  let run = 0;
  for (const line of stripCodeBlocks(text).split("\n")) {
    const indented = /^( {4,}|\t)\S/.test(line);
    const body = line.trim();
    if (indented && !LIST_MARKER_RE.test(body) && CODE_LINE_RE.test(body)) {
      run += 1;
      if (run >= 2) return true;
    } else if (body !== "") {
      run = 0;
    }
  }
  return false;
}

/** Inline code that is a whole statement, e.g. `for i in range(n):` or `total = 0`. */
function isStatement(span: string): boolean {
  const s = span.trim();
  return (
    /^(def|for|while|if|elif|return|import|class|lambda)\b.+/.test(s) ||
    /[^=!<>]=[^=]/.test(s) ||
    /:\s*$/.test(s)
  );
}

function hasInlineStatement(text: string): boolean {
  return inlineCodeSpans(text).some(isStatement);
}

/**
 * INTEGRITY: in Mode 2 the narrator may quote the student's own code inline,
 * but an inline statement that is NOT in their code could be a corrected line.
 */
function hasForeignInlineStatement(text: string, studentCode: string): boolean {
  const code = studentCode.replace(/\s+/g, "");
  return inlineCodeSpans(text)
    .filter(isStatement)
    .some((span) => !code.includes(span.replace(/\s+/g, "")));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** English: whole words/phrases. Hebrew: substrings (prefixes attach to words). */
function containsPhrase(text: string, lists: { en: string[]; he: string[] }): boolean {
  const lower = text.toLowerCase();
  for (const phrase of lists.en) {
    const re = new RegExp(`(^|[^a-z0-9_])${escapeRe(phrase.toLowerCase())}(?=$|[^a-z0-9_])`, "i");
    if (re.test(lower)) return true;
  }
  return lists.he.some((p) => text.includes(p));
}

function countQuestions(text: string): number {
  return (stripInlineCode(text).match(/[?؟]/g) ?? []).length;
}

function namesUnmentionedTechnique(reply: string, studentText: string): boolean {
  const prose = stripCodeBlocks(reply);
  return TECHNIQUE_TERMS.some((t) => t.reply.test(prose) && !t.student.test(studentText));
}

function blockLineCount(block: string): number {
  return block.replace(/\s+$/, "").split("\n").length;
}

export function isWriteRequest(message: string): boolean {
  return WRITE_REQUEST.en.test(message) || WRITE_REQUEST.he.test(message);
}

const normalizeLine = (l: string) => l.replace(/#.*$/, "").replace(/\s+/g, "");

/** True if any non-trivial line of the student's code appears in the text. */
export function copiesStudentCode(text: string, studentCode: string): boolean {
  const haystack = text
    .split("\n")
    .map(normalizeLine)
    .join("\n");
  return studentCode
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((l) => l.length >= LIMITS.minCopiedLineChars)
    .some((l) => haystack.includes(l));
}

// ─── main entry ───────────────────────────────────────────────────────

export function checkReply(task: Task, reply: string, ctx: GuardContext = {}): GuardResult {
  const fail = (rule: GuardRule): GuardResult => ({ ok: false, rule });
  const blocks = extractCodeBlocks(reply);

  switch (task) {
    case "breakdown":
    case "summary": {
      if (blocks.length > 0) return fail("code_block");
      if (hasIndentedCode(reply)) return fail("indented_code");
      if (hasInlineStatement(reply)) return fail("inline_code_statement");
      if (task === "breakdown" && countQuestions(reply) > 1) return fail("multiple_questions");
      if (containsPhrase(stripInlineCode(reply), APPROACH_PHRASES)) return fail("approach_suggestion");
      if (namesUnmentionedTechnique(reply, ctx.studentText ?? "")) return fail("approach_suggestion");
      return { ok: true };
    }

    case "narrator": {
      if (blocks.length > 0) return fail("code_block");
      if (hasIndentedCode(reply)) return fail("indented_code");
      if (hasForeignInlineStatement(reply, ctx.studentCode ?? "")) return fail("inline_code_statement");
      // Inline code is stripped first so the student's own names (e.g. `fix_list`) don't trigger it.
      if (containsPhrase(stripInlineCode(reply), FIX_LANGUAGE)) return fail("fix_language");
      return { ok: true };
    }

    case "syntax": {
      if (blocks.length > LIMITS.syntaxMaxBlocks) return fail("too_many_blocks");
      if (blocks.some((b) => blockLineCount(b) > LIMITS.maxBlockLines)) return fail("block_too_long");
      if (
        ctx.userMessage &&
        isWriteRequest(ctx.userMessage) &&
        blocks.some((b) => /(^|\s)def\s/.test(b))
      ) {
        return fail("task_function");
      }
      return { ok: true };
    }

    case "recap": {
      if (blocks.length > LIMITS.recapMaxBlocks) return fail("too_many_blocks");
      if (blocks.some((b) => blockLineCount(b) > LIMITS.maxBlockLines)) return fail("block_too_long");
      if (ctx.studentCode && copiesStudentCode(reply, ctx.studentCode)) return fail("copied_student_code");
      return { ok: true };
    }
  }
}

/** Logs only the rule name (no user content). */
export function logRejection(task: Task, rule: GuardRule, attempt: number): void {
  console.warn(`[guard] mode=${task} rule=${rule} attempt=${attempt}`);
}
