export const SUPPORTED_LOCALES = [
  "en",
  "it",
  "es",
  "fr",
  "de",
  "pt",
  "cs",
  "ja",
  "zh",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = "cc_locale";

/** Endonyms for the language switcher */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  it: "Italiano",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  cs: "Čeština",
  ja: "日本語",
  zh: "中文",
};

/** Flag emoji for language switcher (language ≠ country; best-effort) */
export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  en: "🇺🇸",
  it: "🇮🇹",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  pt: "🇧🇷",
  cs: "🇨🇿",
  ja: "🇯🇵",
  zh: "🇨🇳",
};

/** BCP 47 tags for Intl date/number formatting */
export const LOCALE_INTL: Record<SupportedLocale, string> = {
  en: "en-US",
  it: "it-IT",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  cs: "cs-CZ",
  ja: "ja-JP",
  zh: "zh-CN",
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | undefined | null): SupportedLocale {
  if (!value) return "en";
  const base = value.toLowerCase().split("-")[0] ?? "en";
  if (isSupportedLocale(base)) return base;
  return "en";
}
