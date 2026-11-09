"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { locales, localeNativeName, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav aria-label={t("language")} className="flex items-center gap-1 text-sm">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          className={`rounded-md px-2 py-1 ${
            locale === current ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:text-text"
          }`}
        >
          {localeNativeName[locale]}
        </Link>
      ))}
    </nav>
  );
}
