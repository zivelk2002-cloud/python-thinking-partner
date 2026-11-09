"use client";

import { useTranslations } from "next-intl";
import { Markdown } from "./Markdown";
import type { Msg } from "./SessionProvider";

export function MessageBubble({ msg, title }: { msg: Msg; title?: string }) {
  const t = useTranslations();

  if (msg.kind === "error") {
    return (
      <div role="alert" className="rounded-xl bg-error-bg px-4 py-3 text-sm text-error-text">
        {t(`errors.${msg.errorCode ?? "unavailable"}`, {
          minutes: Math.max(1, Math.ceil((msg.retryAfter ?? 60) / 60)),
        })}
      </div>
    );
  }

  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "rounded-ee-sm bg-student text-student-text"
            : msg.kind === "summary"
              ? "w-full max-w-full border border-primary/40 bg-primary-soft"
              : "rounded-es-sm border border-border bg-surface"
        }`}
      >
        <span className="sr-only">{isUser ? t("chat.you") : t("chat.assistant")}: </span>
        {title && <p className="mb-1 font-semibold">{title}</p>}
        {isUser ? (
          <p dir="auto" className="whitespace-pre-wrap break-words">
            {msg.content}
          </p>
        ) : (
          <Markdown text={msg.content} />
        )}
      </div>
    </div>
  );
}
