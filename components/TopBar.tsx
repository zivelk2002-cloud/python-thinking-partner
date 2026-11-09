import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ModeTabs } from "./ModeTabs";

export function TopBar() {
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 font-semibold text-text">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-sm text-on-primary">
              ?
            </span>
            <span className="truncate">{t("siteName")}</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Link href="/rules" className="rounded-md px-2 py-1 text-sm text-primary underline-offset-2 hover:underline">
              {t("rules")}
            </Link>
          </div>
        </div>
        <ModeTabs />
      </div>
    </header>
  );
}
