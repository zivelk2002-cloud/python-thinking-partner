/**
 * Combines a results file with human grades and prints the summary tables (Markdown).
 *
 *   npx tsx scripts/red-team/summarize.ts results/<stamp>.json [more results…] grades/<stamp>.json
 *
 * grades file: { "<caseId>#<run>": { "verdict": "PASS" | "SOFT FAIL" | "HARD FAIL" | "GUARD-SAVED",
 *                                    "reason": "...", "guardFalsePositive"?: true } }
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const resolve = (p: string) => (path.isAbsolute(p) ? p : path.join(HERE, p));

const VERDICTS = ["PASS", "SOFT FAIL", "HARD FAIL", "GUARD-SAVED"] as const;
type Verdict = (typeof VERDICTS)[number];

interface Grade {
  verdict: Verdict;
  reason: string;
  guardFalsePositive?: boolean;
}
interface Run {
  caseId: string;
  run: number;
  category: string;
  mode: string;
  lang: string;
  requests: { outcome: string; guardEvents: unknown[] }[];
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("usage: summarize.ts <results.json> [more-results.json …] <grades.json>");
  process.exit(1);
}
const gradesArg = args.pop()!;
const results = {
  runs: args.flatMap((a) => (JSON.parse(readFileSync(resolve(a), "utf8")) as { runs: Run[] }).runs),
};
const grades = JSON.parse(readFileSync(resolve(gradesArg), "utf8")) as Record<string, Grade>;

const rows = results.runs.map((r) => {
  const g = grades[`${r.caseId}#${r.run}`] as Grade | undefined;
  const verdict: Verdict | "UNGRADED" = g?.verdict ?? "UNGRADED";
  return { ...r, verdict, fp: !!g?.guardFalsePositive };
});

const ungraded = rows.filter((r) => r.verdict === "UNGRADED");
if (ungraded.length) console.log(`> ⚠ ${ungraded.length} ungraded runs: ${ungraded.map((r) => `${r.caseId}#${r.run}`).join(", ")}\n`);

function table(title: string, key: (r: (typeof rows)[number]) => string) {
  const groups = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const k = key(r);
    const g = groups.get(k) ?? {};
    g[r.verdict] = (g[r.verdict] ?? 0) + 1;
    g.total = (g.total ?? 0) + 1;
    groups.set(k, g);
  }
  console.log(`**${title}**\n`);
  console.log(`| ${title} | PASS | SOFT FAIL | HARD FAIL | GUARD-SAVED | total |`);
  console.log("|---|---|---|---|---|---|");
  for (const [k, g] of [...groups.entries()].sort()) {
    console.log(`| ${k} | ${VERDICTS.map((v) => g[v] ?? 0).join(" | ")} | ${g.total} |`);
  }
  const all = rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {});
  if (title === "Overall") return;
  console.log(`| **all** | ${VERDICTS.map((v) => all[v] ?? 0).join(" | ")} | ${rows.length} |\n`);
}

const CATEGORY_NAMES: Record<string, string> = {
  A: "A Direct",
  B: "B Authority/emotion",
  C: "C Role-play",
  D: "D Injection",
  E: "E Wording loopholes",
  F: "F Salami/escalation",
  G: "G Mode rules",
  H: "H Extraction",
  I: "I Recap",
  J: "J Abuse/robustness",
};

table("Mode", (r) => r.mode);
table("Category", (r) => CATEGORY_NAMES[r.category] ?? r.category);
table("Language", (r) => r.lang);

const guardFired = rows.filter((r) => r.requests.some((q) => q.guardEvents.length));
const fallbacks = rows.filter((r) => r.requests.some((q) => q.outcome === "fallback"));
console.log(
  `Guard activity: fired in ${guardFired.length} runs, final fallback in ${fallbacks.length}; ` +
    `${rows.filter((r) => r.fp).length} judged false positives (good reply blocked).`,
);
