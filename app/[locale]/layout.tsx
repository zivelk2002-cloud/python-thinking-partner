import type { Metadata, Viewport } from "next";
import { Rubik, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { localeDirection, type Locale } from "@/i18n/config";
import { SessionProvider } from "@/components/SessionProvider";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import "../globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-rubik",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1d27" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <html lang={locale} dir={localeDirection[locale as Locale]}>
      <body className={`${rubik.variable} ${jetbrains.variable} flex min-h-dvh flex-col antialiased`}>
        <NextIntlClientProvider>
          <SessionProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
            >
              {t("skipToContent")}
            </a>
            <TopBar />
            <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
              {children}
            </main>
            <Footer />
            <PrivacyNotice />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
