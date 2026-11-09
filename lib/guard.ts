/**
 * Output guard: runs server-side on every model reply before it is shown.
 * Free models sometimes ignore system prompts; this is the second line of
 * defence. INTEGRITY: when a check is ambiguous, it rejects. A rejected
 * reply is retried once and then replaced by a safe fallback message.
 */
import type { Task } from "@/lib/modes";
import {
  ALGORITHMIC_REQUEST,
  APPROACH_PHRASES,
  FIX_LANGUAGE,
  HYPOTHETICAL_QUESTION,
  HYPOTHETICAL_REPLY,
  JUDGEMENT_PHRASES,
  REFUSAL_SENTENCE,
  SHARED_VOCAB,
  TECHNIQUE_TERMS,
  WRITE_REQUEST,
  type PhraseLists,
} from "./guard-words";

export type GuardRule =
  | "code_block"
  | "indented_code"
  | "inline_code_statement"
  | "fix_language"
  | "judgement_language"
  | "hypothetical_change"
  | "multiple_questions"
  | "approach_suggestion"
  | "too_many_blocks"
  | "block_too_long"
  | "task_function"
  | "inline_solution_line"
  | "student_data_in_example"
  | "copied_student_code";

export type GuardResult = { ok: true } | { ok: false; rule: GuardRule };

export interface GuardContext {
  /** The student's latest message (Mode 3 task-shaped checks). */
  userMessage?: string;
  /** Everything the student wrote in this conversation (Mode 1 technique check, Mode 3 data check). */
  studentText?: string;
  /** The student's Mode 2 code (narrator inline check, recap overlap check). */
  studentCode?: string;
}

export const LIMITS = {
  syntaxMaxBlocks: 2,
  recapMaxBlocks: 6,
  maxBlockLines: 10,
  /** Student code lines shorter than this (whitespace removed) are too generic to count as copied. */
  minCopiedLineChars: 12,
  /** Student words shorter than this are too generic to count as "their data". */
  minStudentTokenChars: 3,
};

/** Short English description of each rule, used in the retry reminder. */
export const RULE_DESCRIPTIONS: Record<GuardRule, string> = {
  code_block: "it contained a code block. This mode allows no code blocks at all",
  indented_code: "it contained lines of code. This mode allows no code at all",
  inline_code_statement:
    "it contained a line of code that is not in the student's code. Write values and arithmetic in words, and quote only the student's own code",
  fix_language:
    "it used fix or judgement language (like should, instead, fix, wrong, replace). Describe only what the code does, neutrally",
  judgement_language:
    "it judged the code against what it is supposed to do (e.g. 'only whether', 'not how many', 'correctly'). Never judge correctness; describe only what the code does",
  hypothetical_change:
    "it described a changed or hypothetical version of the code. Only describe the code as submitted; say the student can edit and resubmit it",
  multiple_questions: "it asked more than one question. Ask exactly ONE question",
  approach_suggestion:
    "it suggested an approach, technique, option, or function the student did not mention. Only build on the student's own ideas, and don't list options",
  too_many_blocks: "it had too many code blocks. Use at most 2 tiny examples",
  block_too_long: "a code example was too long. Keep each example to at most 8 lines",
  task_function:
    "it wrote a function for the student's task. Do not write task code; explain the language features with unrelated toy examples and no `def`",
  inline_solution_line:
    "it wrote a line of the solution inline. For task-shaped questions, name the operators and features instead of writing statements",
  student_data_in_example:
    "an example reused the student's own data, names, or values. Examples must use only generic toy data (fruits, pets, colors, grades) and names unrelated to the student's messages",
  copied_student_code: "it included the student's own code. The recap must contain no lines from the student's code",
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

/** Arithmetic written as an equation, e.g. `3 + 4 = 7`: a description, not code. */
function isArithmetic(span: string): boolean {
  return /^[\d\s+\-*/%().]+=\s*-?[\d.]+$/.test(span.trim());
}

/** Inline code that is a whole statement, e.g. `for i in range(n):` or `total = 0`. */
function isStatement(span: string): boolean {
  const s = span.trim();
  if (isArithmetic(s)) return false;
  return (
    /^(def|for|while|if|elif|return|import|class|lambda)\b.+/.test(s) ||
    /[^=!<>]=[^=]/.test(s) ||
    /:\s*$/.test(s)
  );
}

function hasInlineStatement(text: string): boolean {
  return inlineCodeSpans(text).some(isStatement);
}

function identifiersIn(code: string): Set<string> {
  return new Set(code.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
}

/**
 * INTEGRITY: in Mode 2 the narrator may quote the student's own code inline,
 * but an inline statement that is NOT in their code could be a corrected line.
 * Exception: `name = value` where `name` is one of the student's variables is a
 * description of a value (e.g. "on the first pass `i = 0`"), not new code.
 */
function hasForeignInlineStatement(text: string, studentCode: string): boolean {
  const code = studentCode.replace(/\s+/g, "");
  const names = identifiersIn(studentCode);
  return inlineCodeSpans(text)
    .filter(isStatement)
    .filter((span) => {
      const m = /^([A-Za-z_]\w*)\s*=\s*(-?\d+(\.\d+)?|"[^"]*"|'[^']*'|True|False|None)$/.exec(span.trim());
      return !(m && names.has(m[1]));
    })
    .some((span) => !code.includes(span.replace(/\s+/g, "")));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** English: whole words/phrases. Hebrew and Arabic: substrings (prefixes attach to words). */
function containsPhrase(text: string, lists: PhraseLists): boolean {
  const lower = text.toLowerCase();
  for (const phrase of lists.en) {
    const re = new RegExp(`(^|[^a-z0-9_])${escapeRe(phrase.toLowerCase())}(?=$|[^a-z0-9_])`, "i");
    if (re.test(lower)) return true;
  }
  return lists.he.some((p) => text.includes(p)) || lists.ar.some((p) => text.includes(p));
}

/**
 * Removes short refusal sentences ("I can only describe what the code does; I can't
 * give instructions on fixing it.") so the model's own refusals don't trip the
 * fix-word checks. Sentences that point at a line or quote code are kept.
 */
function stripRefusals(text: string): string {
  return text
    .split(/(?<=[.!?؟\n])/)
    .filter((s) => {
      const refusal = REFUSAL_SENTENCE.en.test(s) || REFUSAL_SENTENCE.he.test(s) || REFUSAL_SENTENCE.ar.test(s);
      const specific = /`|\b(line|שורה|السطر)\s*\d/i.test(s) || /שורה\s*\d/.test(s);
      return !(refusal && !specific && s.length < 200);
    })
    .join("");
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
  return WRITE_REQUEST.en.test(message) || WRITE_REQUEST.he.test(message) || WRITE_REQUEST.ar.test(message);
}

export function isAlgorithmicRequest(message: string): boolean {
  return ALGORITHMIC_REQUEST.en.test(message) || ALGORITHMIC_REQUEST.he.test(message) || ALGORITHMIC_REQUEST.ar.test(message);
}

/** Task-shaped Mode 3 request: asks for task code or for an algorithmic step. */
export function isTaskShaped(message: string): boolean {
  return isWriteRequest(message) || isAlgorithmicRequest(message);
}

/** Mode 2 follow-up that asks about a changed or hypothetical version of the code. */
export function isHypotheticalQuestion(message: string, studentCode = ""): boolean {
  if (HYPOTHETICAL_QUESTION.en.test(message) || HYPOTHETICAL_QUESTION.he.test(message) || HYPOTHETICAL_QUESTION.ar.test(message)) {
    return true;
  }
  // A full statement that isn't in the submitted code (e.g. "`for i in range(len(m)):` ok?").
  // Plain expressions like `range(1, n)` are fine: asking what they mean is a narration question.
  const code = studentCode.replace(/\s+/g, "");
  const candidates = [
    ...inlineCodeSpans(message).filter(isStatement),
    ...(message.match(/\b(for|while|if|elif)\b[^\n?`]*:/g) ?? []),
  ];
  return candidates.some((c) => {
    const norm = c.replace(/\s+/g, "");
    return norm.length >= 6 && !code.includes(norm);
  });
}

function describesHypothetical(reply: string): boolean {
  const prose = stripInlineCode(reply);
  return (
    HYPOTHETICAL_REPLY.en.some((re) => re.test(prose)) || HYPOTHETICAL_REPLY.he.test(prose) || HYPOTHETICAL_REPLY.ar.test(prose)
  );
}

/** Words and literals the student wrote (Latin script), minus generic vocabulary. */
function studentTokens(studentText: string): Set<string> {
  const tokens = new Set<string>();
  for (const t of studentText.toLowerCase().match(/[a-z_][a-z0-9_]*/g) ?? []) {
    if (t.length >= LIMITS.minStudentTokenChars && !SHARED_VOCAB.has(t)) tokens.add(t);
  }
  return tokens;
}

/**
 * INTEGRITY: Mode 3 examples must not adopt the student's data or names
 * (`nums`, `matrix`, "aeiou", `second`): that is how examples drift onto the task.
 */
function examplesUseStudentData(blocks: string[], studentText: string): boolean {
  const theirs = studentTokens(studentText);
  if (theirs.size === 0) return false;
  return blocks.some((b) => {
    const noComments = b.replace(/#.*$/gm, "");
    const names = (noComments.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).map((n) => n.toLowerCase());
    return names.some((n) => theirs.has(n));
  });
}

const normalizeLine = (l: string) => l.replace(/#.*$/, "").replace(/\s+/g, "");

/** True if any non-trivial line of the student's code appears in the text. */
export function copiesStudentCode(text: string, studentCode: string): boolean {
  const haystack = text.split("\n").map(normalizeLine).join("\n");
  return studentCode
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((l) => l.length >= LIMITS.minCopiedLineChars)
    .some((l) => haystack.includes(l));
}

/** Lines that look like Python code, e.g. code pasted into a chat message (recap overlap check). */
export function codeLikeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim();
      return CODE_LINE_RE.test(t) && /[=(:\[]/.test(t) && !/[֐-׿؀-ۿ]/.test(t);
    });
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
      if (describesHypothetical(reply)) return fail("hypothetical_change");
      // Inline code is stripped first so the student's own names (e.g. `fix_list`) don't trigger it,
      // and refusal sentences are stripped so "I can't help fixing it" doesn't either.
      const prose = stripRefusals(stripInlineCode(reply));
      if (containsPhrase(prose, FIX_LANGUAGE)) return fail("fix_language");
      if (containsPhrase(prose, JUDGEMENT_PHRASES)) return fail("judgement_language");
      return { ok: true };
    }

    case "syntax": {
      if (blocks.length > LIMITS.syntaxMaxBlocks) return fail("too_many_blocks");
      if (blocks.some((b) => blockLineCount(b) > LIMITS.maxBlockLines)) return fail("block_too_long");
      const taskShaped = !!ctx.userMessage && isTaskShaped(ctx.userMessage);
      if (taskShaped && blocks.some((b) => /(^|\s)def\s/.test(b))) return fail("task_function");
      if (taskShaped && hasInlineStatement(stripCodeBlocks(reply))) return fail("inline_solution_line");
      if (examplesUseStudentData(blocks, ctx.studentText ?? ctx.userMessage ?? "")) {
        return fail("student_data_in_example");
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
export function logRejection(task: Task, rule: GuardRule, attempt: number, rejectedText?: string): void {
  console.warn(`[guard] mode=${task} rule=${rule} attempt=${attempt}`);
  // Red-team instrumentation only: opt-in, and never in production builds,
  // so student content never reaches production logs.
  if (process.env.GUARD_DEBUG === "1" && process.env.NODE_ENV !== "production" && rejectedText !== undefined) {
    console.warn(`[guard-debug] mode=${task} rule=${rule} attempt=${attempt} text=${JSON.stringify(rejectedText)}`);
  }
}
