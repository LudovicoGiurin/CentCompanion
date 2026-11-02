import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type SupportedLocale,
} from "./lib/locales";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enEvents from "./locales/en/events.json";
import enTournament from "./locales/en/tournament.json";
import enDashboard from "./locales/en/dashboard.json";
import enAdmin from "./locales/en/admin.json";
import enLegal from "./locales/en/legal.json";
import enGibbo from "./locales/en/gibbo.json";

import itCommon from "./locales/it/common.json";
import itAuth from "./locales/it/auth.json";
import itEvents from "./locales/it/events.json";
import itTournament from "./locales/it/tournament.json";
import itDashboard from "./locales/it/dashboard.json";
import itAdmin from "./locales/it/admin.json";
import itLegal from "./locales/it/legal.json";
import itGibbo from "./locales/it/gibbo.json";

import esCommon from "./locales/es/common.json";
import esAuth from "./locales/es/auth.json";
import esEvents from "./locales/es/events.json";
import esTournament from "./locales/es/tournament.json";
import esDashboard from "./locales/es/dashboard.json";
import esAdmin from "./locales/es/admin.json";
import esLegal from "./locales/es/legal.json";
import esGibbo from "./locales/es/gibbo.json";

import frCommon from "./locales/fr/common.json";
import frAuth from "./locales/fr/auth.json";
import frEvents from "./locales/fr/events.json";
import frTournament from "./locales/fr/tournament.json";
import frDashboard from "./locales/fr/dashboard.json";
import frAdmin from "./locales/fr/admin.json";
import frLegal from "./locales/fr/legal.json";
import frGibbo from "./locales/fr/gibbo.json";

import deCommon from "./locales/de/common.json";
import deAuth from "./locales/de/auth.json";
import deEvents from "./locales/de/events.json";
import deTournament from "./locales/de/tournament.json";
import deDashboard from "./locales/de/dashboard.json";
import deAdmin from "./locales/de/admin.json";
import deLegal from "./locales/de/legal.json";
import deGibbo from "./locales/de/gibbo.json";

import ptCommon from "./locales/pt/common.json";
import ptAuth from "./locales/pt/auth.json";
import ptEvents from "./locales/pt/events.json";
import ptTournament from "./locales/pt/tournament.json";
import ptDashboard from "./locales/pt/dashboard.json";
import ptAdmin from "./locales/pt/admin.json";
import ptLegal from "./locales/pt/legal.json";
import ptGibbo from "./locales/pt/gibbo.json";

import csCommon from "./locales/cs/common.json";
import csAuth from "./locales/cs/auth.json";
import csEvents from "./locales/cs/events.json";
import csTournament from "./locales/cs/tournament.json";
import csDashboard from "./locales/cs/dashboard.json";
import csAdmin from "./locales/cs/admin.json";
import csLegal from "./locales/cs/legal.json";
import csGibbo from "./locales/cs/gibbo.json";

import jaCommon from "./locales/ja/common.json";
import jaAuth from "./locales/ja/auth.json";
import jaEvents from "./locales/ja/events.json";
import jaTournament from "./locales/ja/tournament.json";
import jaDashboard from "./locales/ja/dashboard.json";
import jaAdmin from "./locales/ja/admin.json";
import jaLegal from "./locales/ja/legal.json";
import jaGibbo from "./locales/ja/gibbo.json";

import zhCommon from "./locales/zh/common.json";
import zhAuth from "./locales/zh/auth.json";
import zhEvents from "./locales/zh/events.json";
import zhTournament from "./locales/zh/tournament.json";
import zhDashboard from "./locales/zh/dashboard.json";
import zhAdmin from "./locales/zh/admin.json";
import zhLegal from "./locales/zh/legal.json";
import zhGibbo from "./locales/zh/gibbo.json";

const NAMESPACES = [
  "common",
  "auth",
  "events",
  "tournament",
  "dashboard",
  "admin",
  "legal",
  "gibbo",
] as const;

function pack(
  common: object,
  auth: object,
  events: object,
  tournament: object,
  dashboard: object,
  admin: object,
  legal: object,
  gibbo: object,
) {
  return { common, auth, events, tournament, dashboard, admin, legal, gibbo };
}

const resources = {
  en: pack(enCommon, enAuth, enEvents, enTournament, enDashboard, enAdmin, enLegal, enGibbo),
  it: pack(itCommon, itAuth, itEvents, itTournament, itDashboard, itAdmin, itLegal, itGibbo),
  es: pack(esCommon, esAuth, esEvents, esTournament, esDashboard, esAdmin, esLegal, esGibbo),
  fr: pack(frCommon, frAuth, frEvents, frTournament, frDashboard, frAdmin, frLegal, frGibbo),
  de: pack(deCommon, deAuth, deEvents, deTournament, deDashboard, deAdmin, deLegal, deGibbo),
  pt: pack(ptCommon, ptAuth, ptEvents, ptTournament, ptDashboard, ptAdmin, ptLegal, ptGibbo),
  cs: pack(csCommon, csAuth, csEvents, csTournament, csDashboard, csAdmin, csLegal, csGibbo),
  ja: pack(jaCommon, jaAuth, jaEvents, jaTournament, jaDashboard, jaAdmin, jaLegal, jaGibbo),
  zh: pack(zhCommon, zhAuth, zhEvents, zhTournament, zhDashboard, zhAdmin, zhLegal, zhGibbo),
};

function syncDocumentLang(lng: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = normalizeLocale(lng);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [...NAMESPACES],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

syncDocumentLang(i18n.language);
i18n.on("languageChanged", syncDocumentLang);

export function getAppLocale(): SupportedLocale {
  return normalizeLocale(i18n.language);
}

export async function setAppLocale(locale: SupportedLocale) {
  await i18n.changeLanguage(locale);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export default i18n;
