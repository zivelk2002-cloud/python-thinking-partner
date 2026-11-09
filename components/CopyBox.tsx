"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

/** A labelled block of text with a Copy button (clipboard API, with a select-and-copy fallback). */
export function CopyBox({
  label,
  text,
  children,
}: {
  label: string;
  text: string;
  /** Optional rich preview; the raw `text` is what gets copied. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("recap");
  const [copied, setCopied] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const labelId = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = fallbackRef.current;
      if (!el) return;
      el.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={labelId} className="text-sm font-semibold">
          {label}
        </h3>
        <button
          type="button"
          onClick={copy}
          className="min-h-9 rounded-lg bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
        </button>
      </div>
      <div className="max-h-64 overflow-auto rounded-xl border border-border bg-surface-2 p-3 text-sm">
        {children ?? <p className="whitespace-pre-wrap">{text}</p>}
      </div>
      <textarea ref={fallbackRef} value={text} readOnly aria-hidden tabIndex={-1} className="sr-only" />
    </section>
  );
}
