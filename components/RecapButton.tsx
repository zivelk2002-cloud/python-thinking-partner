"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { requestRecap, type ClientResult } from "@/lib/clientApi";
import type { RecapRequestBody } from "@/lib/api";
import { CopyBox } from "./CopyBox";
import { Dialog } from "./Dialog";
import { Markdown } from "./Markdown";
import { useSession, type SessionState } from "./SessionProvider";

const NOTEBOOKLM_URL = "https://notebooklm.google.com/";

/**
 * INTEGRITY: the transcript sent for the recap contains the conversations only.
 * The raw Mode 2 code is sent separately as `studentCode`, which the server uses
 * only to check that no line of it ends up in the recap (students share videos;
 * sharing code is forbidden).
 */
function buildRecapRequest(state: SessionState, locale: string): RecapRequestBody {
  const transcript: RecapRequestBody["transcript"] = [];
  const add = (mode: string, msgs: SessionState["syntax"]["messages"]) => {
    for (const m of msgs) {
      if (m.kind && m.kind !== "normal") continue;
      transcript.push({ mode, role: m.role, content: m.content });
    }
  };
  add("breakdown", state.breakdown.messages);
  add("narrator", state.narrator.messages);
  add("syntax", state.syntax.messages);
  return { locale, transcript, studentCode: state.narrator.allCode.join("\n") };
}

export function RecapButton() {
  const t = useTranslations("recap");
  const tErr = useTranslations("errors");
  const locale = useLocale();
  const { state, hasContent } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClientResult<{ recap: string }> | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setResult(null);
    setResult(await requestRecap(buildRecapRequest(state, locale)));
    setLoading(false);
  }

  if (!hasContent) return null;

  return (
    <>
      <button
        type="button"
        onClick={generate}
        title={t("buttonHint")}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
      >
        <span aria-hidden>▶</span>
        {t("button")}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} labelledBy="recap-title" wide>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h2 id="recap-title" className="text-lg font-semibold">
              {t("title")}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-muted hover:bg-surface-2"
            >
              ×
            </button>
          </div>

          {loading && (
            <p role="status" className="text-muted">
              {t("generating")}
            </p>
          )}

          {result && !result.ok && (
            <div role="alert" className="flex flex-col gap-2 rounded-xl bg-error-bg p-3 text-sm text-error-text">
              <p>
                {tErr(result.error, { minutes: Math.max(1, Math.ceil((result.retryAfter ?? 60) / 60)) })}
              </p>
              <button type="button" onClick={generate} className="self-start font-medium underline">
                {tErr("retry")}
              </button>
            </div>
          )}

          {result?.ok && (
            <>
              <p className="text-sm text-muted">{t("intro")}</p>
              <CopyBox label={t("recapLabel")} text={result.recap}>
                <Markdown text={result.recap} />
              </CopyBox>
              <CopyBox label={t("promptLabel")} text={t("videoPrompt")} />
              <section aria-labelledby="recap-steps" className="rounded-xl bg-primary-soft p-3 text-sm">
                <h3 id="recap-steps" className="mb-2 font-semibold">
                  {t("stepsTitle")}
                </h3>
                <ol className="list-decimal space-y-1 ps-5">
                  {(t.raw("steps") as string[]).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <a
                  href={NOTEBOOKLM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-lg bg-primary px-3 py-2 font-medium text-on-primary hover:bg-primary-hover"
                >
                  {t("openNotebook")} ↗
                </a>
              </section>
              <p className="text-xs text-muted">{t("sharingNote")}</p>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
