"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";

const KEY = "ptp-privacy-ack";

/** Shown once per tab session (sessionStorage), so nothing outlives the tab. */
export function PrivacyNotice() {
  const t = useTranslations("privacy");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {
      // Storage unavailable: show the notice.
    }
    if (!seen) setOpen(true);
  }, []);

  function acknowledge() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onClose={acknowledge} labelledBy="privacy-title">
      <h2 id="privacy-title" className="mb-2 text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="mb-4 text-sm leading-relaxed">{t("text")}</p>
      <button
        type="button"
        onClick={acknowledge}
        autoFocus
        className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-on-primary hover:bg-primary-hover"
      >
        {t("ok")}
      </button>
    </Dialog>
  );
}
