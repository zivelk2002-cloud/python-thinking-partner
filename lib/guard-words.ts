/**
 * Word and phrase lists used by lib/guard.ts. Keep EN and HE separate so
 * they're easy to edit. When adding Arabic, add an `ar` list next to each.
 *
 * English entries are matched as whole words/phrases (case-insensitive).
 * Hebrew entries are matched as substrings, because Hebrew attaches
 * prefixes (ו, ה, ל, ש, ב, כ, מ) directly to words.
 */

/** Mode 2: fix/judgement language. The narrator must stay neutral. */
export const FIX_LANGUAGE = {
  en: [
    "should",
    "shouldn't",
    "instead",
    "fix",
    "fixes",
    "fixed",
    "fixing",
    "correct version",
    "corrected",
    "change line",
    "change the",
    "replace",
    "try using",
    "try changing",
    "try adding",
    "you need to",
    "you have to",
    "bug",
    "mistake",
    "wrong",
    "better to",
    "probably meant",
    "intended",
    "to avoid",
  ],
  he: [
    "צריך לשנות",
    "צריך להיות",
    "במקום",
    "תקן",
    "תיקון",
    "התיקון",
    "נסה להשתמש",
    "נסי להשתמש",
    "נסו להשתמש",
    "כדאי",
    "עדיף",
    "לשנות",
    "תשנה",
    "שגוי",
    "טעות",
    "באג",
    "כדי להימנע",
  ],
};

/** Modes 1 + summary: phrases that hand the student an approach. */
export const APPROACH_PHRASES = {
  en: [
    "you could use",
    "you can use",
    "you might use",
    "you should use",
    "try using",
    "consider using",
    "how about using",
    "what if you used",
    "what if you use",
    "i suggest",
    "i recommend",
    "a good approach",
    "the best approach",
    "one approach",
    "one way to",
  ],
  he: [
    "אפשר להשתמש ב",
    "ניתן להשתמש ב",
    "כדאי להשתמש",
    "תוכל להשתמש",
    "תוכלי להשתמש",
    "נסה להשתמש",
    "נסי להשתמש",
    "מה אם תשתמש",
    "מה אם תשתמשי",
    "אני מציע",
    "אני ממליץ",
    "גישה טובה",
    "דרך אחת",
  ],
};

/**
 * Mode 1 + summary: specific techniques. If the reply names one of these and
 * the student never wrote it, the model is introducing an approach.
 * Each entry: [pattern for the reply, patterns that count as "student mentioned it"].
 */
export const TECHNIQUE_TERMS: { reply: RegExp; student: RegExp }[] = [
  { reply: /\bdict(ionary|ionaries)?\b|מילון/i, student: /\bdict|מילון/i },
  { reply: /\brecursi(on|ve|vely)\b|רקורסי/i, student: /recurs|רקורסי/i },
  { reply: /\bsort(ed|ing)?\b|\.sort\(|למיין|מיון|ממוינ/i, student: /sort|מיין|מיון|ממוינ/i },
  { reply: /\bbinary search\b|חיפוש בינארי/i, student: /binary|בינארי/i },
  { reply: /\bstack\b|מחסנית/i, student: /stack|מחסנית/i },
  { reply: /\bqueue\b/i, student: /queue|תור/i },
  { reply: /\blist comprehension\b/i, student: /comprehension/i },
  { reply: /\benumerate\b/i, student: /enumerate/i },
  { reply: /\bzip\b/i, student: /\bzip\b/i },
  { reply: /\bsplit\b|\.split\(/i, student: /split|פיצול|לפצל/i },
  { reply: /\bjoin\b|\.join\(/i, student: /join|לחבר|איחוד/i },
  { reply: /\bset\(|`set`/i, student: /\bset\b|קבוצה/i },
  { reply: /\bmax\(|\bmin\(|\bsum\(|\blen\(/i, student: /max|min|sum|len|מקסימום|מינימום|סכום|אורך/i },
  { reply: /\bcounter\b|collections/i, student: /counter|collections|מונה/i },
  { reply: /\bslic(e|ing)\b|חיתוך/i, student: /slic|חיתוך/i },
  { reply: /\btwo pointers?\b|שני מצביעים/i, student: /pointer|מצביע/i },
];

/** Mode 3: the user's message asks for task code. */
export const WRITE_REQUEST = {
  en: /\b(write|create|make|build|code|implement|give me|show me|generate)\b[\s\S]{0,40}?\b(function|program|script|method|def|code that|solution)\b/i,
  he: /(כתוב|תכתוב|תכתבי|לכתוב|כתבי|צור|תיצור|תצור|ליצור|צרי|לממש|תממש|תממשי|תן לי|תני לי)[\s\S]{0,40}?(פונקציה|פונקצייה|תוכנית|תכנית|תוכנה|קוד|פתרון)/,
};
