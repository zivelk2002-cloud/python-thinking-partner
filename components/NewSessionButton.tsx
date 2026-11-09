"use client";

import { useTranslations } from "next-intl";
import { useSession } from "./SessionProvider";

export function NewSessionButton() {
  const t = useTranslations("nav");
  const { reset } = useSession();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm(t("newSessionConfirm"))) reset();
      }}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-surface-2"
    >
      {t("newSession")}
    </button>
  );
}
