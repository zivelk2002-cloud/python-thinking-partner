/**
 * Heuristic: does this Mode 3 message contain a block of the student's own code?
 * INTEGRITY: Mode 3 doesn't analyse student code; such messages are redirected
 * to Mode 2 instead of being sent. Tracebacks alone are allowed through
 * (explaining error messages is permitted).
 */
const TRACEBACK_RE = /^(Traceback \(most recent call last\):|File ".*", line \d+|\w+(Error|Exception|Warning)\b.*:|\^+~*)$/;
const CODE_RE =
  /^(def|for|while|if|elif|else|return|print|import|from|class|try|except|with|lambda|break|continue|pass)\b|^[A-Za-z_][\w.[\]]*\s*(=|\+=|-=|\*=|\/=)\s*\S|^[A-Za-z_][\w.]*\(.*\)\s*$|:\s*(#.*)?$/;

export const MIN_CODE_LINES = 4;

export function looksLikeCode(text: string): boolean {
  if (/```/.test(text) && text.split("\n").length >= MIN_CODE_LINES) return true;
  let codeLines = 0;
  let prevWasTraceFile = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (TRACEBACK_RE.test(line)) {
      prevWasTraceFile = /^File "/.test(line);
      continue;
    }
    // The source line Python prints right after `File "...", line N` is part of the traceback.
    if (prevWasTraceFile) {
      prevWasTraceFile = false;
      continue;
    }
    if (CODE_RE.test(line) || /^( {2,}|\t)\S/.test(raw)) codeLines += 1;
  }
  return codeLines >= MIN_CODE_LINES;
}
