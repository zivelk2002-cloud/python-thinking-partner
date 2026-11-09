/**
 * Word and phrase lists used by lib/guard.ts, per language.
 *
 * English entries are matched as whole words/phrases (case-insensitive).
 * Hebrew and Arabic entries are matched as substrings, because both languages
 * attach prefixes (HE: ו, ה, ל, ש, ב, כ, מ; AR: و, ف, ب, ل, ال) directly to words.
 */

export interface PhraseLists {
  en: string[];
  he: string[];
  ar: string[];
}

/** Mode 2: fix/judgement language. The narrator must stay neutral. */
export const FIX_LANGUAGE: PhraseLists = {
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
  ar: ["يجب أن", "بدلاً من", "بدلا من", "إصلاح", "لإصلاح", "تصحيح", "صحح", "استبدل", "حاول استخدام", "من الأفضل", "غيّر"],
};

/** Mode 2: judging the code against what it "should" do. */
export const JUDGEMENT_PHRASES: PhraseLists = {
  en: [
    "only whether",
    "not how many",
    "never increased",
    "never incremented",
    "never increases",
    "rather than",
    "doesn't actually",
    "does not actually",
    "as expected",
    "correctly",
    "incorrect",
    "incorrectly",
    "isn't counting",
    "is not counting",
    "doesn't work",
    "does not work",
  ],
  he: ["ולא כמה", "רק האם", "לא באמת", "כמצופה", "כמו שצריך", "באופן נכון", "לא עובד", "לא עובדת", "לא תקין"],
  ar: ["بشكل صحيح", "لا يعمل", "وليس كم"],
};

/** Modes 1 + summary: phrases that hand the student an approach. */
export const APPROACH_PHRASES: PhraseLists = {
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
    "by position",
    "by index",
    "adding or removing",
    "add or remove",
    "such as a list",
    "or a dictionary",
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
    "לפי מיקום",
    "לפי אינדקס",
    "הוספה או הסרה",
    "להוסיף או להסיר",
  ],
  ar: ["يمكنك استخدام", "يمكن استخدام", "جرب استخدام", "أقترح", "أنصح", "طريقة جيدة"],
};

/**
 * Mode 1 + summary: specific techniques. If the reply names one of these and
 * the student never wrote it, the model is introducing an approach.
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
  ar: /(اكتب|اكتبي|أنشئ|انشئ|اعمل|برمج)[\s\S]{0,40}?(دالة|دالّة|برنامج|كود|شيفرة|حل)/,
};

/**
 * Mode 3: the user's message asks how to perform an algorithmic step, or to
 * assemble earlier pieces. Treated as task-shaped even without "write a function".
 */
export const ALGORITHMIC_REQUEST = {
  en: /\b(keep track of (the )?(biggest|largest|smallest|maximum|minimum|max|min|highest|lowest|two)|second (largest|biggest|smallest|highest|lowest)|at the same time|put (it|them|those|these|everything|all) together|combine (them|those|these|it|the examples|everything)|(into|in) one function|wrap (it|that|this|them) in a function|turn (it|that|this) into a function)\b/i,
  he: /(השני בגודלו|השני הכי|באותו זמן|ביחד|תחבר|לחבר את|תשלב|לשלב את|בפונקציה אחת|לפונקציה אחת|תעטוף)/,
  ar: /(في دالة واحدة|اجمعها|ادمجها|في نفس الوقت)/,
};

/** Mode 2: the student asks about a changed/hypothetical version of their code. */
export const HYPOTHETICAL_QUESTION = {
  en: /\b(what (would|will|could) happen if|what if|would it (work|print|return)|will it (work|print|return)|if (i|we|you) (change|changed|replace|replaced|use|used|add|added|remove|removed|delete|deleted|swap|swapped|put|write|wrote|make|made|start|started)|if line \d+ (said|says|were|was|is changed|read|had|used)|instead of|what should (line|it|i)|how should)\b/i,
  he: /(מה (היה|יהיה|יקרה) (קורה )?אם|מה אם|אם (אני |אנחנו )?(אשנה|אחליף|אשים|אוסיף|אמחק|אכתוב|נשנה|נחליף|אתחיל)|אם בשורה \d+ (היה|יהיה|יהיו|הייתה|תהיה)|היה כתוב|במקום|האם זה יעבוד|האם יעבוד)/,
  ar: /(ماذا (لو|سيحدث لو|يحدث إذا)|إذا (غيرت|استبدلت|أضفت|حذفت)|بدلاً من|بدلا من|هل سيعمل)/,
};

/** Mode 2 replies that narrate a changed/hypothetical version of the code. */
export const HYPOTHETICAL_REPLY = {
  en: [
    /\bif\s+(line\s+\d+|the\s+(loop|line|code|condition|range|function|call)[^.\n]{0,40}?)\s+(said|says|were|was\s+(changed|written|replaced|modified)|used|started|began|read|had)\b/i,
    /\b(were|was|is)\s+(changed|replaced|modified|rewritten|edited)\s+(to|with|into)\b/i,
    /\bhad\s+been\s+written\b/i,
  ],
  he: /(יוחלף|יוחלפו|היה כתוב|הייתה כתובה|היו כתובים|אילו |לו היה|אם היינו|אם (הלולאה|השורה|התנאי|הקוד)[^.\n]{0,30}(הייתה|היה|היו) )/,
  ar: /(لو كان|لو تم تغيير|إذا تم تغيير|إذا استبدلت)/,
};

/** Sentences that are refusals; stripped before fix/judgement checks so "I can't help fixing it" passes. */
export const REFUSAL_SENTENCE = {
  en: /\b(can['’]?t|cannot|can only|unable to|not able to|won['’]?t)\b/i,
  he: /(לא יכול|לא יכולה|אינני יכול|איני יכול|יכול רק|יכולה רק|אני רק)/,
  ar: /(لا أستطيع|لا يمكنني|يمكنني فقط)/,
};

/**
 * Mode 3: words that may appear both in the student's messages and in toy
 * examples without meaning the example adopted the student's data.
 */
export const SHARED_VOCAB = new Set([
  // Python keywords
  ..."and as assert async await break class continue def del elif else except false finally for from global if import in is lambda none nonlocal not or pass raise return true try while with yield".split(" "),
  // Built-ins and common methods
  ..."abs all any append bool break chr clear copy count dict divmod enumerate extend filter float format get index input insert int isdigit isinstance items join keys len list lower map max min next open ord pop pow print range remove replace reverse reversed round set sort sorted split str strip sum tuple type upper values zip".split(" "),
  // Generic programming words
  ..."lists string strings item items element elements value result results example examples data loop loops function functions variable variables print the and for with".split(" "),
  // Toy domains the prompts ask for
  ..."fruit fruits apple apples pet pets cat cats dog dogs animal animals color colors colour colours red green blue yellow grade grades score scores student students name names".split(" "),
]);
