import type { EventItem } from "./api";
import i18n, { getAppLocale } from "../i18n";
import { formatAppDate } from "./formatLocale";
import { LOCALE_INTL } from "./locales";

export function eventTypeLabel(type?: EventItem["eventType"]) {
  switch (type) {
    case "lv2":
      return i18n.t("common:eventType.lv2");
    case "lv1":
      return i18n.t("common:eventType.lv1");
    case "local_league":
      return i18n.t("common:eventType.localLeague");
    default:
      return i18n.t("common:eventType.casual");
  }
}

export function eventTypeChipClass(type?: EventItem["eventType"]) {
  switch (type) {
    case "lv2":
      return "sc-chip--red";
    case "lv1":
      return "sc-chip--gold";
    case "local_league":
      return "sc-chip--cyan";
    default:
      return "sc-chip--primary";
  }
}

export function eventStatusLabel(status: string) {
  switch (status) {
    case "ongoing":
      return i18n.t("common:eventStatus.live");
    case "completed":
      return i18n.t("common:eventStatus.completed");
    case "cancelled":
      return i18n.t("common:eventStatus.cancelled");
    default:
      return i18n.t("common:eventStatus.upcoming");
  }
}

export function eventStatusChipClass(status: string) {
  switch (status) {
    case "ongoing":
      return "sc-chip--gold cc-chip--live";
    case "completed":
      return "sc-chip--cyan";
    case "cancelled":
      return "sc-chip--red";
    default:
      return "sc-chip--primary";
  }
}

export function formatEventDateParts(iso: string) {
  const d = new Date(iso);
  const locale = LOCALE_INTL[getAppLocale()];
  return {
    weekday: formatAppDate(d, { weekday: "short" }),
    month: formatAppDate(d, { month: "short" }),
    day: d.getDate(),
    year: d.getFullYear(),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
    long: formatAppDate(d, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}
