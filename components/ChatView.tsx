"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble";
import type { Msg } from "./SessionProvider";

interface ChatViewProps {
  messages: Msg[];
  onSend: (text: string) => void;
  loading: boolean;
  inputLabel: string;
  placeholder: string;
  /** Rendered after the messages, above the input (e.g. chips, action buttons). */
  belowMessages?: React.ReactNode;
  /** Title shown above summary messages. */
  summaryTitle?: string;
  /** Monospace LTR input (for questions that are mostly code). */
  inputDir?: "auto" | "ltr";
}

export function ChatView({
  messages,
  onSend,
  loading,
  inputLabel,
  placeholder,
  belowMessages,
  summaryTitle,
  inputDir = "auto",
}: ChatViewProps) {
  const t = useTranslations("chat");
  const [text, setText] = useState("");
  const inputId = useId();
  const hintId = useId();
  const endRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevCount.current || loading) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCount.current = messages.length;
  }, [messages.length, loading]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || loading) return;
    onSend(value);
    setText("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="log" aria-live="polite" aria-label={t("conversation")} className="flex flex-col gap-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} title={m.kind === "summary" ? summaryTitle : undefined} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-muted">
              <span className="flex gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
              </span>
              {t("sending")}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {belowMessages}

      <form onSubmit={submit} className="flex flex-col gap-1">
        <label htmlFor={inputId} className="sr-only">
          {inputLabel}
        </label>
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 focus-within:border-primary">
          <textarea
            id={inputId}
            dir={inputDir}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
            }}
            rows={2}
            maxLength={4000}
            placeholder={placeholder}
            aria-describedby={hintId}
            className={`max-h-48 min-h-11 flex-1 resize-y bg-transparent px-2 py-1.5 outline-none placeholder:text-muted ${
              inputDir === "ltr" ? "font-mono text-sm" : ""
            }`}
          />
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="min-h-11 shrink-0 rounded-xl bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {t("send")}
          </button>
        </div>
        <p id={hintId} className="hidden px-2 text-xs text-muted sm:block">
          {t("enterHint")}
        </p>
      </form>
    </div>
  );
}
