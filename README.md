# Python Thinking Partner

A guided-learning website for students in an intro Python course. It helps students **think**, and it never writes, completes, fixes, or suggests code for their assignments.

| Mode | What it does | What it never does |
|---|---|---|
| **1. Break it down** | Asks one guiding question at a time; "Summarise my thinking" turns the student's answers into their own plan | Suggest an approach, show code, or read the assignment |
| **2. What does my code do?** | Narrates the student's code line by line, using their program output/traceback | Judge, fix, or guess what the code was supposed to do |
| **3. Syntax help** | Explains syntax, built-ins and error messages with tiny toy examples | Write code for the student's task |
| **Video recap** | Writes a concept-only recap + a NotebookLM video prompt | Include the student's code or assignment |

Hebrew (default, RTL) and English. No accounts, no database: session state lives in the browser tab and is gone when the tab closes.

> **The one rule:** every design decision exists to keep the site on the "allowed" side of the course's academic-integrity policy (see the in-app **Rules** page). Code comments marked `// INTEGRITY:` explain the decisions that follow from it. When changing anything, keep the more restrictive behaviour.

---

## How the integrity rules are enforced

1. **No input for the assignment.** Mode 1 has only a chat box; Mode 2 accepts only code and output, with no "expected behaviour" field.
2. **System prompts** ([`lib/prompts/`](lib/prompts/)) share a block of absolute rules, plus one block per mode.
3. **Output guard** ([`lib/guard.ts`](lib/guard.ts)) runs server-side on every reply before it is shown:
   - Modes 1 and 2: no code blocks or code lines.
   - Mode 2: no fix/judgement words, EN and HE. Lists are in [`lib/guard-words.ts`](lib/guard-words.ts).
   - Mode 1: one question only, and no techniques the student didn't mention.
   - Mode 3: at most 2 examples of 10 lines or fewer, and no `def` when the student asked for a function.
   - Recap: no lines copied from the student's code.

   A rejected reply is retried once with a reminder. If the retry is also rejected, the student sees a safe localized message. Logs contain only the rule name.
4. **Mode 3 redirects pasted code** to Mode 2 instead of sending it.
5. **The recap never sends the student's code to the model.** The code is used only for the guard's overlap check.

---

## Local setup

Requirements: Node 20+ (tested on Node 24) and npm.

```bash
npm install
cp .env.example .env.local      # then add at least one API key (see below)
npm run dev                      # http://localhost:3000 → redirects to /he
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build and server |
| `npm test` | Vitest unit tests (guard, pipeline, LLM fallback, rate limiter, message files) |
| `npm run lint` | ESLint |
| `npm run red-team` | Sends the adversarial prompts to a running server (see [`tests/red-team.md`](tests/red-team.md)) |

Without any API key the site still loads, and every AI request shows the friendly "the free AI is busy" message.

## Getting free API keys

You need **at least one** key; more keys mean more fallback capacity. Free-tier limits and model IDs change often, so check each provider's docs before changing models.

| Provider | Get a key | Notes |
|---|---|---|
| **Groq** (first by default) | [console.groq.com/keys](https://console.groq.com/keys) | Fast. Default model `openai/gpt-oss-120b`. See [models](https://console.groq.com/docs/models) and [rate limits](https://console.groq.com/docs/rate-limits) |
| **Google Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Called via its OpenAI-compatible endpoint. Default `gemini-3.5-flash-lite`. See the [model list](https://ai.google.dev/gemini-api/docs/models). Free-tier data may be used by Google to improve its products |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | Default `openrouter/free` (routes to a random free model). Any `…:free` model ID also works. Free models allow 20 requests/min and 50/day (1000/day after buying $10 of credit) |

The privacy notice in the app says providers may use the text to improve their models. Keep it if you add providers.

## Environment variables

All are set in `.env.local` locally and in **Vercel → Project → Settings → Environment Variables** in production. See [`.env.example`](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER_ORDER` | `groq,gemini,openrouter` | Fallback order. Providers without a key are skipped |
| `GROQ_API_KEY`, `GROQ_MODEL` | – | Groq |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | – | Gemini |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | – | OpenRouter |
| `*_BASE_URL` | provider default | Optional endpoint override (e.g. a proxy) |
| `LLM_TIMEOUT_MS` | `25000` | Per-provider timeout. On timeout, 429 or 5xx the next provider is tried |
| `RATE_LIMIT_MAX` | `20` | AI requests per IP per 10 minutes |

Model names live **only** in env vars, never in code.

## Deploying to Vercel

1. Push this repo to GitHub (or GitLab or Bitbucket).
2. In Vercel: **Add New → Project**, import the repo. The Next.js framework preset is detected automatically.
3. Add the environment variables above (at least one key + model) for Production (and Preview if you want).
4. Deploy. The API routes run as Node serverless functions with `maxDuration = 60` s, which the Hobby plan allows.

Or from the CLI: `npx vercel`, then `npx vercel env add GROQ_API_KEY`, and so on, then `npx vercel --prod`.

## Editing the prompts

| File | Contents |
|---|---|
| [`lib/prompts/shared.ts`](lib/prompts/shared.ts) | Absolute rules prepended to every prompt |
| [`lib/prompts/breakdown.ts`](lib/prompts/breakdown.ts) | Mode 1 prompt, the 8 core questions, and the "summarise my thinking" prompt |
| [`lib/prompts/narrator.ts`](lib/prompts/narrator.ts) | Mode 2 prompt. The code is sent with line numbers added |
| [`lib/prompts/syntax.ts`](lib/prompts/syntax.ts) | Mode 3 prompt |
| [`lib/prompts/recap.ts`](lib/prompts/recap.ts) | Video recap prompt |
| [`lib/prompts/index.ts`](lib/prompts/index.ts) | Temperatures, history length (last 10 messages), and size limits |

Prompts are in English and tell the model to reply in the UI language. The first Mode 1 question is shown from the message files without an API call.

After editing a prompt or the guard:
1. Run `npm test`.
2. Run the red-team script (`npm run red-team`) and **read every reply**.
3. If the guard starts rejecting good replies, tune the lists in [`lib/guard-words.ts`](lib/guard-words.ts) and add a test case to [`tests/guard.test.ts`](tests/guard.test.ts).

The NotebookLM video prompt and the recap title are UI strings in `messages/*.json` (`recap.videoPrompt`, `recap.docTitle`).

## Adding a language (Arabic)

1. **[`i18n/config.ts`](i18n/config.ts):** add `"ar"` to `locales`, and add entries to `localeDirection` (`"rtl"`), `localeLanguageName` (`"Arabic"`, used in prompts) and `localeNativeName` (`"العربية"`).
2. **`messages/ar.json`:** copy `en.json` and translate every value. The `tests/messages.test.ts` test fails until the keys match.
3. **[`app/[locale]/layout.tsx`](app/%5Blocale%5D/layout.tsx):** add a font with Arabic glyphs, e.g. `Noto_Sans_Arabic` from `next/font/google`, and include it in the font stack in `app/globals.css`.
4. **[`app/api/recap/route.ts`](app/api/recap/route.ts):** add `ar` to `DOC_TITLE`. TypeScript will point to it.
5. **Guard:** add Arabic lists next to `en`/`he` in [`lib/guard-words.ts`](lib/guard-words.ts): fix language, approach phrases, and the write-request regex. Use substring matching (like Hebrew) and update `containsPhrase` in `lib/guard.ts` to check them. The question counter already handles `؟`.
6. Add Arabic cases to `scripts/red-team-cases.ts` and run them.

All layout uses logical properties (`ms-`, `ps-`, `start-`, `text-start`), and code is always `dir="ltr"`, so RTL needs no extra CSS.

## Rate limiting

The limit is 20 AI requests per IP per 10 minutes, kept in memory per server instance ([`lib/rateLimit.ts`](lib/rateLimit.ts)). **On Vercel this is approximate.** Each serverless instance has its own memory, and instances are recycled.

**If abuse happens, upgrade to Upstash Redis.** It is free via the Vercel Marketplace:
1. In Vercel: **Storage → Marketplace → Upstash → Redis**, then connect it to the project. This adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
2. Run `npm i @upstash/ratelimit @upstash/redis`.
3. Replace `aiLimiter` with:
   ```ts
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";
   const rl = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(20, "10 m") });
   // in the route: const { success, reset } = await rl.limit(ip);
   ```

## Project layout

```
app/[locale]/        pages (home with the three modes, rules), html lang/dir per locale
app/api/chat         modes 1–3 + "summarise my thinking"
app/api/recap        video recap
components/          UI (modes/, chat, code blocks, recap modal, …)
i18n/                locales, routing, request config
lib/llm/             OpenAI-compatible client with provider fallback
lib/prompts/         system prompts
lib/guard.ts         output guard (+ guard-words.ts)
lib/pipeline.ts      model call → guard → retry once → fallback
messages/            he.json, en.json
scripts/red-team.ts  adversarial prompt runner
tests/               Vitest tests + red-team.md
```

---

## בעברית בקצרה

**שותף חשיבה לפייתון** הוא אתר שעוזר לסטודנטים בקורס מבוא לפייתון לחשוב. האתר לעולם לא כותב, משלים, מתקן או מציע קוד למטלות.

- **פירוק הבעיה:** שאלות מנחות, אחת בכל פעם.
- **מה הקוד שלי עושה?:** תיאור מילולי וניטרלי של הקוד, בלי שיפוט ובלי תיקון.
- **עזרה בתחביר:** הסברים עם דוגמאות כלליות (פירות, חיות מחמד, צבעים).
- **סיכום בווידאו:** מסמך מושגים בלבד, בלי קוד, ליצירת סרטון ב-NotebookLM.

**הרצה מקומית:** `npm install`, להעתיק את `.env.example` ל-`.env.local` ולהוסיף לפחות מפתח API אחד (Groq, Gemini או OpenRouter, כולם בחינם), ואז `npm run dev`.

**פריסה:** לייבא את הריפו ל-Vercel, להגדיר את משתני הסביבה, ולפרוס.

**עריכת ההנחיות:** בתיקייה `lib/prompts/`. אחרי כל שינוי מריצים `npm test` ו-`npm run red-team`, וקוראים כל תשובה.

**הוספת ערבית:** ראו את הסעיף "Adding a language" למעלה.

**הגבלת קצב:** ההגבלה הנוכחית נשמרת בזיכרון ולכן משוערת ב-Vercel. אם יש שימוש לרעה, עוברים ל-Upstash Redis (חינם דרך Vercel Marketplace).
