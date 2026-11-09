"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { requestChat } from "@/lib/clientApi";
import { looksLikeCode } from "@/lib/looksLikeCode";
import { ChatView } from "../ChatView";
import { InlineCode } from "../InlineCode";
import { resultToMessage, toHistory, userMessage } from "../chatHelpers";
import { useSession, type Msg } from "../SessionProvider";

/** Mode 3: syntax and concept questions, answered with generic toy examples. */
export function SyntaxMode() {
  const t = useTranslations("modes.syntax");
  const locale = useLocale();
  const { state, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [pastedCode, setPastedCode] = useState<string | null>(null);
  const messages = state.syntax.messages;
  const chips = t.raw("chips") as string[];

  const append = (msg: Msg) => update((s) => ({ ...s, syntax: { messages: [...s.syntax.messages, msg] } }));

  async function send(text: string) {
    // INTEGRITY: a block of the student's own code is not sent here; Mode 2 handles code.
    if (looksLikeCode(text)) {
      setPastedCode(text);
      return;
    }
    setPastedCode(null);
    const user = userMessage(text);
    append(user);
    setLoading(true);
    const res = await requestChat({ mode: "syntax", locale, messages: toHistory([...messages, user]) });
    append(resultToMessage(res));
    setLoading(false);
  }

  function goToNarrator() {
    const code = (pastedCode ?? "").replace(/```\w*/g, "").trim();
    update((s) => ({
      ...s,
      activeMode: "narrator",
      narrator: { ...s.narrator, code, output: "", submitted: null, messages: [] },
    }));
    setPastedCode(null);
  }

  return (
    <ChatView
      messages={messages}
      onSend={send}
      loading={loading}
      inputLabel={t("inputLabel")}
      placeholder={t("placeholder")}
      belowMessages={
        <>
          {pastedCode && (
            <div role="status" className="flex flex-col gap-2 rounded-xl bg-warn-bg p-3 text-sm text-warn-text sm:flex-row sm:items-center">
              <p className="flex-1">{t("codeDetected")}</p>
              <button
                type="button"
                onClick={goToNarrator}
                className="rounded-lg bg-primary px-3 py-2 font-medium text-on-primary hover:bg-primary-hover"
              >
                {t("toNarrator")}
              </button>
            </div>
          )}
          {messages.length === 0 && (
            <section aria-label={t("chipsLabel")} className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={loading}
                  onClick={() => send(chip)}
                  className="max-w-full rounded-full border border-border bg-surface px-3 py-1.5 text-start text-sm break-words hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  <InlineCode text={chip} />
                </button>
              ))}
            </section>
          )}
        </>
      }
    />
  );
}
