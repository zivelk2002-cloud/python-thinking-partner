"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { MODES, type Mode } from "@/lib/prompts";
import { useSession } from "./SessionProvider";

/** Accessible tablist (arrow keys move between tabs). On other pages, picking a tab returns home. */
export function ModeTabs() {
  const t = useTranslations("modes");
  const tNav = useTranslations("nav");
  const { state, setMode } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onHome = pathname === "/";

  function choose(mode: Mode) {
    setMode(mode);
    if (!onHome) router.push("/");
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const rtl = document.documentElement.dir === "rtl";
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const prev = rtl ? "ArrowRight" : "ArrowLeft";
    let target = -1;
    if (e.key === next) target = (index + 1) % MODES.length;
    else if (e.key === prev) target = (index - 1 + MODES.length) % MODES.length;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = MODES.length - 1;
    if (target < 0) return;
    e.preventDefault();
    refs.current[target]?.focus();
    choose(MODES[target]);
  }

  return (
    <div role="tablist" aria-label={tNav("modes")} className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      {MODES.map((mode, i) => {
        const selected = onHome && state.activeMode === mode;
        return (
          <button
            key={mode}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${mode}`}
            aria-selected={selected}
            aria-controls={onHome ? `panel-${mode}` : undefined}
            tabIndex={selected || (!onHome && i === 0) ? 0 : -1}
            onClick={() => choose(mode)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-h-11 rounded-lg px-2 py-1.5 text-sm leading-tight font-medium transition-colors ${
              selected ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            {t(`${mode}.tab`)}
          </button>
        );
      })}
    </div>
  );
}
