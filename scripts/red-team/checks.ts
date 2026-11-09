/**
 * Non-LLM security checks for the red team:
 *   1. Client bundle / page HTML: no API keys, provider endpoints, or system prompts.
 *   2. Markdown renderer: XSS payloads in model output are not executable.
 *   3. Provider failure: a bad key fails closed with a generic error (no key/details).
 *
 * Run (needs JSX compiled for React, hence the tsconfig):
 *   npx tsx --tsconfig scripts/red-team/tsconfig.checks.json scripts/red-team/checks.ts [baseUrl]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../../components/Markdown";
import { chatCompletion } from "../../lib/llm/client";
import { AllProvidersFailedError } from "../../lib/llm/types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const results: Check[] = [];
const record = (id: string, pass: boolean, detail: string) => {
  results.push({ id, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${id}: ${detail}`);
};

function envSecrets(): string[] {
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => /^\w+_API_KEY=(.+)$/.exec(l.trim())?.[1]?.trim())
    .filter((v): v is string => !!v && v.length > 8);
}

// ─── 1. bundle scan ───────────────────────────────────────────────────

async function bundleScan() {
  const pages = ["/he", "/en", "/he/rules"];
  const assets = new Set<string>();
  const files: { name: string; text: string }[] = [];
  for (const p of pages) {
    const html = await (await fetch(`${BASE}${p}`)).text();
    files.push({ name: `page ${p}`, text: html });
    for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) assets.add(m[1]);
  }
  for (const a of assets) {
    const url = a.startsWith("http") ? a : `${BASE}${a}`;
    files.push({ name: a, text: await (await fetch(url)).text() });
  }
  const corpus = files.map((f) => f.text).join("\n");
  const where = (re: RegExp) =>
    files
      .filter((f) => re.test(f.text))
      .map((f) => `${f.name} ("${re.exec(f.text)?.[0]}")`)
      .join("; ");
  const secrets = envSecrets();
  const needles: [string, RegExp | string][] = [
    ["api-key-value", ""],
    ["gsk_ prefix (Groq key)", /gsk_[A-Za-z0-9]{20,}/],
    ["AIza prefix (Google key)", /AIza[0-9A-Za-z_-]{30,}/],
    ["sk-or- prefix (OpenRouter key)", /sk-or-[A-Za-z0-9-]{20,}/],
    ["env var names", /GROQ_API_KEY|GEMINI_API_KEY|OPENROUTER_API_KEY/],
    ["provider endpoints", /api\.groq\.com|generativelanguage\.googleapis\.com|openrouter\.ai\/api/],
    ["shared rules prompt", /Absolute rules|learning companion for students/],
    ["mode prompts", /Mode: Code narrator|Mode: Syntax help|Mode: Break it down|Forbidden words and ideas/],
    // Strings unique to lib/guard-words.ts ("probably meant" also appears in React's own errors).
    ["guard word lists", /נסה להשתמש|never incremented|not how many|TECHNIQUE_TERMS|HYPOTHETICAL_REPLY|SHARED_VOCAB/],
  ];
  const leakedKey = secrets.some((s) => corpus.includes(s));
  record("bundle:api-key-value", !leakedKey, leakedKey ? "an API key from .env.local appears in client assets!" : `scanned ${assets.size} scripts + ${pages.length} pages; no key value found`);
  for (const [name, re] of needles.slice(1)) {
    const found = typeof re === "string" ? corpus.includes(re) : re.test(corpus);
    record(`bundle:${name}`, !found, found ? `FOUND in ${where(re as RegExp)}` : "not present");
  }
}

// ─── 2. markdown XSS ──────────────────────────────────────────────────

function xssChecks() {
  const payloads: [string, string][] = [
    ["raw-script", "Hello <script>alert(1)</script> world"],
    ["img-onerror", '<img src=x onerror="alert(document.cookie)">'],
    ["svg-onload", "<svg onload=alert(1)></svg>"],
    ["iframe", '<iframe src="javascript:alert(1)"></iframe>'],
    ["md-js-link", "[Python docs](javascript:alert(document.cookie))"],
    ["md-js-link-upper", "[docs](JAVASCRIPT:alert(1))"],
    ["md-js-link-spaced", "[docs](  javascript:alert(1))"],
    ["md-js-link-entity", "[docs](&#106;avascript:alert(1))"],
    ["md-js-link-tab", "[docs](java\tscript:alert(1))"],
    ["md-data-link", "[docs](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)"],
    ["md-vbscript-link", "[docs](vbscript:msgbox(1))"],
    ["autolink-js", "<javascript:alert(1)>"],
    ["md-image-remote", "![x](https://example.com/track.png)"],
    ["md-image-js", "![x](javascript:alert(1))"],
    ["html-a-js", '<a href="javascript:alert(1)">click</a>'],
    ["reference-link-js", "[docs][1]\n\n[1]: javascript:alert(1)"],
    ["code-fence-script", "```html\n<script>alert(1)</script>\n```"],
  ];
  for (const [id, md] of payloads) {
    const html = renderToStaticMarkup(createElement(Markdown, { text: md }));
    const problems: string[] = [];
    if (/<script/i.test(html)) problems.push("<script> element");
    if (/<(img|svg|iframe)\b/i.test(html)) problems.push("img/svg/iframe element");
    // Only real tags count; escaped text like "&lt;img onerror=" is inert.
    if (/<[a-z][^>]*\son[a-z]+=/i.test(html)) problems.push("inline event handler attribute");
    if (/href="\s*(javascript|vbscript|data):/i.test(html)) problems.push("dangerous href");
    record(`xss:${id}`, problems.length === 0, problems.length ? `${problems.join(", ")} → ${html.slice(0, 160)}` : html.slice(0, 120));
  }
}

// ─── 3. provider failure ──────────────────────────────────────────────

async function providerFailure() {
  const realKeys = envSecrets();
  const fakeKey = "gsk_this_is_not_a_real_key_000000000000000000000000";
  try {
    await chatCompletion(
      { messages: [{ role: "user", content: "hi" }], temperature: 0 },
      { providers: [{ id: "groq", baseUrl: "https://api.groq.com/openai/v1", apiKey: fakeKey, model: "openai/gpt-oss-120b" }] },
    );
    record("provider:bad-key", false, "bad key unexpectedly succeeded");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const ok = err instanceof AllProvidersFailedError && !msg.includes(fakeKey) && !realKeys.some((k) => msg.includes(k));
    record("provider:bad-key", ok, `throws ${err instanceof Error ? err.name : "?"}: "${msg}" (no key in message: ${ok})`);
  }
  // Route-level shape: error responses carry only a code.
  const res = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
  const text = await res.text();
  const clean = /^\{"ok":false,"error":"[a-z_]+"(,"retryAfter":\d+)?\}$/.test(text);
  record("route:error-shape", clean, `HTTP ${res.status} ${text.slice(0, 120)}`);
}

async function main() {
  console.log(`Security checks against ${BASE}\n`);
  await bundleScan();
  console.log();
  xssChecks();
  console.log();
  await providerFailure();
  const dir = path.join(HERE, "results");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `checks-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed. Saved ${file}`);
  if (failed) process.exitCode = 1;
}

main();
