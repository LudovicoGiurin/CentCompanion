import { useCallback, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { resolveReturnPath } from "../lib/authReturn";
import { Page } from "../components/Motion";
import { OAuthProviders } from "../components/OAuthProviders";
import { PrivacyConsentField } from "../components/PrivacyConsentField";
import { isTurnstileEnabled, TurnstileWidget } from "../components/TurnstileWidget";

export function RegisterPage() {
  const { t } = useTranslation(["auth", "common"]);
  const [searchParams] = useSearchParams();
  const returnTo = resolveReturnPath(searchParams.get("return"), "/profile");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(t("register.passwordsMismatch"));
      return;
    }
    if (isTurnstileEnabled() && !turnstileToken) {
      setError(t("common:securityCheck.label"));
      return;
    }
    if (!privacyAccepted) {
      setError(t("register.acceptPrivacy"));
      return;
    }
    setBusy(true);
    try {
      const data = await api.register({
        email,
        username,
        password,
        firstName,
        lastName,
        turnstileToken: turnstileToken || undefined,
        privacyAccepted: true as const,
      });
      setSuccessMessage(data.message);
      if (data.devVerifyUrl) setVerifyUrl(data.devVerifyUrl);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("register.failed"));
      setTurnstileToken("");
    } finally {
      setBusy(false);
    }
  };

  const onTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  const usernameHasInvalidChars = /[^a-zA-Z0-9_]/.test(username);
  const verifyPath = verifyUrl ? verifyUrl.replace(/^https?:\/\/[^/]+/, "") : "";
  const loginHref = `/login?return=${encodeURIComponent(returnTo)}`;

  if (done) {
    return (
      <Page>
        <div className="cc-auth">
          <article className="sc-card cc-auth-success">
            <div className="cc-auth-success__icon" aria-hidden="true">
              <i className="ph ph-envelope-simple" />
            </div>
            <h1 className="sc-card__title">{t("register.done.title")}</h1>
            <p>{successMessage}</p>
            <p className="sc-body-sm">{t("register.done.body", { email })}</p>
            {verifyPath && (
              <p className="sc-body-sm">
                <Link to={verifyPath} className="sc-btn sc-btn--secondary sc-btn--sm">
                  {t("register.done.verifyNow")}
                </Link>
              </p>
            )}
            <p className="sc-body-sm">
              {t("register.done.didntGet")}{" "}
              <Link to={`/resend-verification?login=${encodeURIComponent(email)}`}>
                {t("login.resendVerification")}
              </Link>
            </p>
            <Link to={loginHref} className="sc-btn" style={{ marginTop: 16 }}>
              {t("register.done.continue")}
            </Link>
          </article>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="cc-auth">
        <article className="sc-card">
          <div className="sc-card__header">
            <h1 className="sc-card__title">{t("register.title")}</h1>
          </div>
          <form className="cc-form" onSubmit={handleSubmit}>
            {error && <div className="cc-alert cc-alert--error">{error}</div>}
            <label className="sc-field">
              <span className="sc-field__label">{t("register.email")}</span>
              <input className="sc-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
            </label>
            <label className="sc-field">
              <span className="sc-field__label">{t("register.username")}</span>
              <input
                className="sc-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                pattern="[a-zA-Z0-9_]+"
                title={t("register.usernameHint")}
                disabled={busy}
                autoComplete="username"
              />
              {usernameHasInvalidChars ? (
                <span className="sc-field__hint" role="alert">
                  {t("register.usernameInvalid")}
                </span>
              ) : (
                <span className="sc-field__hint">{t("register.usernameHint")}</span>
              )}
            </label>
            <div className="cc-grid-2">
              <label className="sc-field">
                <span className="sc-field__label">{t("register.firstName")}</span>
                <input className="sc-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={busy} />
              </label>
              <label className="sc-field">
                <span className="sc-field__label">{t("register.lastName")}</span>
                <input className="sc-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={busy} />
              </label>
            </div>
            <label className="sc-field">
              <span className="sc-field__label">{t("register.password")}</span>
              <input className="sc-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={busy} autoComplete="new-password" />
            </label>
            <label className="sc-field">
              <span className="sc-field__label">{t("register.confirmPassword")}</span>
              <input className="sc-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} disabled={busy} autoComplete="new-password" />
            </label>
            <TurnstileWidget onToken={onTurnstileToken} />
            <PrivacyConsentField checked={privacyAccepted} onChange={setPrivacyAccepted} />
            <button className="sc-btn" type="submit" disabled={!privacyAccepted || busy}>
              {busy ? t("register.submitting") : t("register.submit")}
            </button>
            <OAuthProviders mode="signup" returnTo={returnTo} />
            <p className="sc-body-sm">
              <Link to={loginHref}>{t("register.haveAccount")}</Link>
            </p>
          </form>
        </article>
      </div>
    </Page>
  );
}
