import i18n from "../i18n";

const MOXFIELD_RE = /^https?:\/\/(www\.)?moxfield\.com\/.+/i;

export function isValidMoxfieldUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    return MOXFIELD_RE.test(new URL(trimmed).href);
  } catch {
    return false;
  }
}

export function moxfieldHint(): string {
  return i18n.t("events:reg.moxfieldHint");
}
