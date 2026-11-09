"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { requestChat } from "@/lib/clientApi";
import { ChatView } from "../ChatView";
import { CodeBlock } from "../CodeBlock";
import { CodeInput } from "../CodeInput";
import { resultToMessage, toHistory, userMessage } from "../chatHelpers";
import { useSession, type Msg } from "../SessionProvider";

const CODE_MAX = 8000;
const OUTPUT_MAX = 4000;

/**
 * Mode 2: literal narrator.
 * INTEGRITY: there is deliberately no "what did you expect" or "what's the task"
 * field. Knowing the goal would let the model steer toward a fix.
 */
export function NarratorMode() {
  const t = useTranslations("modes.narrator");
  const locale = useLocale();
  const { state, update } = useSession();
  const [loading, setLoading] = useState(false);
  const n = state.narrator;

  const setNarrator = (fn: (s: typeof n) => Partial<typeof n>) =>
    update((s) => ({ ...s, narrator: { ...s.narrator, ...fn(s.narrator) } }));
  const append = (msg: Msg) => setNarrator((s) => ({ messages: [...s.messages, msg] }));

  async function describe(e: React.FormEvent) {
    e.preventDefault();
    if (!n.code.trim() || loading) return;
    const submitted = { code: n.code, output: n.output };
    setNarrator((s) => ({
      submitted,
      messages: [],
      allCode: s.allCode.includes(submitted.code) ? s.allCode : [...s.allCode, submitted.code],
    }));
    setLoading(true);
    const res = await requestChat({ mode: "narrator", locale, messages: [], ...submitted });
    append(resultToMessage(res));
    setLoading(false);
  }

  async function followUp(text: string) {
    if (!n.submitted) return;
    const user = userMessage(text);
    append(user);
    setLoading(true);
    const res = await requestChat({
      mode: "narrator",
      locale,
      messages: toHistory([...n.messages, user]),
      ...n.submitted,
    });
    append(resultToMessage(res));
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm leading-relaxed">{t("notice")}</p>

      {!n.submitted ? (
        <form onSubmit={describe} className="flex flex-col gap-3">
          <CodeInput
            label={t("codeLabel")}
            value={n.code}
            onChange={(code) => setNarrator(() => ({ code }))}
            placeholder={t("codePlaceholder")}
            rows={12}
            required
            maxLength={CODE_MAX}
          />
          <CodeInput
            label={t("outputLabel")}
            hint={t("outputHint")}
            value={n.output}
            onChange={(output) => setNarrator(() => ({ output }))}
            placeholder={t("outputPlaceholder")}
            rows={5}
            maxLength={OUTPUT_MAX}
          />
          <button
            type="submit"
            disabled={!n.code.trim() || loading}
            className="min-h-11 self-end rounded-xl bg-primary px-5 font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>
      ) : (
        <>
          <details className="rounded-xl border border-border bg-surface px-3 py-2" open>
            <summary className="cursor-pointer text-sm font-medium">{t("codeShown")}</summary>
            <CodeBlock code={n.submitted.code} lineNumbers />
            {n.submitted.output.trim() && (
              <pre
                dir="ltr"
                className="my-2 max-h-48 overflow-auto rounded-lg border border-border bg-code-bg p-3 text-left font-mono text-[13px] whitespace-pre"
              >
                {n.submitted.output}
              </pre>
            )}
          </details>
          <ChatView
            messages={n.messages}
            onSend={followUp}
            loading={loading}
            inputLabel={t("followUpLabel")}
            placeholder={t("followUpPlaceholder")}
          />
          <button
            type="button"
            onClick={() => setNarrator(() => ({ submitted: null, messages: [] }))}
            disabled={loading}
            className="self-start rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"          >
            {t("editCode")}
          </button>
        </>
      )}
    </div>
  );
}
