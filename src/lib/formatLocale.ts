import { useTranslation } from "react-i18next";
import { getAppLocale } from "../i18n";
import { LOCALE_INTL, type SupportedLocale } from "./locales";

export function useIntlLocale(): string {
  const { i18n } = useTranslation();
  const code = (i18n.language?.split("-")[0] ?? "en") as SupportedLocale;
  return LOCALE_INTL[code] ?? LOCALE_INTL.en;
}

/** Format a date with the active app locale (for non-hook call sites). */
export function formatAppDate(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(LOCALE_INTL[getAppLocale()], options);
}

export function formatAppDateTime(
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(LOCALE_INTL[getAppLocale()], options);
}

export function formatAppNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return value.toLocaleString(LOCALE_INTL[getAppLocale()], options);
}
