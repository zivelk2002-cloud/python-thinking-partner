"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { requestChat } from "@/lib/clientApi";
import { ChatView } from "../ChatView";
import { resultToMessage, toHistory, userMessage } from "../chatHelpers";
import { useSession, type Msg } from "../SessionProvider";

/**
 * Mode 1: guided questions.
 * INTEGRITY: there is deliberately no field for the assignment text.
 */
export function BreakdownMode() {
  const t = useTranslations("modes.breakdown");
  const locale = useLocale();
  const { state, update } = useSession();
  const [busy, setBusy] = useState<"reply" | "summary" | null>(null);
  const stored = state.breakdown.messages;

  // The first core question is shown locally (no API call) and prepended to the history sent.
  const firstQuestion: Msg = { id: "first-question", role: "assistant", content: t("firstQuestion") };
  const shown = [firstQuestion, ...stored];

  const append = (msg: Msg) =>
    update((s) => ({ ...s, breakdown: { messages: [...s.breakdown.messages, msg] } }));

  async function send(text: string) {
    const user = userMessage(text);
    append(user);
    setBusy("reply");
    const res = await requestChat({
      mode: "breakdown",
      locale,
      messages: toHistory([firstQuestion, ...stored, user]),
    });
    append(resultToMessage(res));
    setBusy(null);
  }

  async function summarise() {
    setBusy("summary");
    const res = await requestChat({ mode: "breakdown", action: "summary", locale, messages: toHistory(shown) });
    append(resultToMessage(res, "summary"));
    setBusy(null);
  }

  const canSummarise = stored.some((m) => m.role === "user") && !busy;

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm leading-relaxed">{t("intro")}</p>
      <ChatView
        messages={shown}
        onSend={send}
        loading={busy !== null}
        inputLabel={t("inputLabel")}
        placeholder={t("placeholder")}
        summaryTitle={t("summaryTitle")}
        belowMessages={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={summarise}
              disabled={!canSummarise}
              className="rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-40"
            >
              {busy === "summary" ? t("summarising") : t("summarise")}
            </button>
          </div>
        }
      />
    </div>
  );
}
