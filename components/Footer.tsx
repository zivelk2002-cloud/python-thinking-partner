import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations();
  return (
    <footer className="mt-8 border-t border-border">
      <div className="mx-auto max-w-3xl space-y-1 px-4 py-4 text-xs text-muted">
        <p>{t("privacy.text")}</p>
        <p>
          {t("footer.note")}{" "}
          <Link href="/rules" className="text-primary underline underline-offset-2">
            {t("nav.rules")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
