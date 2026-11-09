"use client";

import { useTranslations } from "next-intl";
import { NewSessionButton } from "./NewSessionButton";
import { useSession } from "./SessionProvider";

export function HomeView() {
  const t = useTranslations("modes");
  const { state } = useSession();
  const mode = state.activeMode;

  return (
    <div
      role="tabpanel"
      id={`panel-${mode}`}
      aria-labelledby={`tab-${mode}`}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted">{t(`${mode}.does`)}</p>
        <div className="flex gap-2">
          <NewSessionButton />
        </div>
      </div>
    </div>
  );
}
