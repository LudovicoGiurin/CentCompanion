const PRIVACY_ACK_KEY = "cc_privacy_ack";

export function hasPrivacyConsent(): boolean {
  try {
    return localStorage.getItem(PRIVACY_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPrivacyConsent(): void {
  localStorage.setItem(PRIVACY_ACK_KEY, "1");
}
