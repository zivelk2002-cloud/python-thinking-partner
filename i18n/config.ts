/**
 * Single source of truth for supported locales.
 * To add Arabic: add "ar" to `locales`, an entry in each map below,
 * and a `messages/ar.json` file (copy en.json and translate).
 */
export const locales = ["he", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  en: "ltr",
};

/** Name of the language as written in English, injected into system prompts. */
export const localeLanguageName: Record<Locale, string> = {
  he: "Hebrew",
  en: "English",
};

/** Label shown in the language switcher (in its own language). */
export const localeNativeName: Record<Locale, string> = {
  he: "עברית",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
