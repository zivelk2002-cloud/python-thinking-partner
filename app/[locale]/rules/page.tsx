import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InlineCode } from "@/components/InlineCode";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rules" });
  return { title: t("title") };
}

function List({ items, marker }: { items: string[]; marker: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 leading-relaxed">
          <span aria-hidden className="shrink-0">
            {marker}
          </span>
          <span>
            <InlineCode text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function RulesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "rules" });

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="leading-relaxed text-muted">{t("intro")}</p>
        <p className="rounded-lg bg-warn-bg p-3 font-medium text-warn-text">{t("keyTest")}</p>
      </header>

      <section aria-labelledby="allowed" className="rounded-xl border border-border bg-surface p-4">
        <h2 id="allowed" className="mb-3 text-lg font-semibold">
          {t("allowedTitle")}
        </h2>
        <List items={t.raw("allowed") as string[]} marker="✓" />
      </section>

      <section aria-labelledby="forbidden" className="rounded-xl border border-border bg-surface p-4">
        <h2 id="forbidden" className="mb-3 text-lg font-semibold">
          {t("forbiddenTitle")}
        </h2>
        <List items={t.raw("forbidden") as string[]} marker="✗" />
      </section>

      <section aria-labelledby="site" className="rounded-xl border border-border bg-surface p-4">
        <h2 id="site" className="mb-3 text-lg font-semibold">
          {t("siteTitle")}
        </h2>
        <List items={t.raw("site") as string[]} marker="•" />
      </section>

      <section aria-labelledby="unsure" className="rounded-xl bg-primary-soft p-4">
        <h2 id="unsure" className="mb-1 text-lg font-semibold">
          {t("unsureTitle")}
        </h2>
        <p className="leading-relaxed">{t("unsure")}</p>
      </section>

      <Link href="/" className="inline-block text-primary underline underline-offset-2">
        {t("back")}
      </Link>
    </article>
  );
}
