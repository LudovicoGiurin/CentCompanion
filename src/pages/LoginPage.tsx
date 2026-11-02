import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { resolveReturnPath } from "../lib/authReturn";
import { api } from "../lib/api";
import { Page } from "../components/Motion";
import { OAuthProviders } from "../components/OAuthProviders";
import { isTurnstileEnabled, TurnstileWidget } from "../components/TurnstileWidget";

export function LoginPage() {
  const { t } = useTranslation(["auth", "common"]);
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = resolveReturnPath(searchParams.get("return"), "/profile");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(returnTo.startsWith("/") ? returnTo : "/profile", { replace: true });
    }
  }, [loading, user, navigate, returnTo]);

  const onTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    if (isTurnstileEnabled() && !turnstileToken) {
      setError(t("common:securityCheck.label"));
      return;
    }
    try {
      setBusy(true);
      await login(loginId, password, turnstileToken || undefined);
      navigate(returnTo.startsWith("/") ? returnTo : "/profile", { replace: true });
    } catch (err) {
      const e = err as Error & { code?: string };
      setError(e.message ?? t("login.failed"));
      setNeedsVerification(e.code === "EMAIL_NOT_VERIFIED");
      setTurnstileToken("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <div className="cc-auth">
        <article className="sc-card">
          <div className="sc-card__header">
            <h1 className="sc-card__title">{t("login.title")}</h1>
          </div>
          <form className="cc-form" onSubmit={handleSubmit}>
            {error && <div className="cc-alert cc-alert--error">{error}</div>}
            {needsVerification && (
              <p className="sc-body-sm">
                <Link to={`/resend-verification?login=${encodeURIComponent(loginId)}`}>
                  {t("login.resendVerification")}
                </Link>
              </p>
            )}
            <label className="sc-field">
              <span className="sc-field__label">{t("login.emailOrUsername")}</span>
              <input
                className="sc-input"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                autoComplete="username"
                disabled={busy}
              />
            </label>
            <label className="sc-field">
              <span className="sc-field__label">{t("login.password")}</span>
              <input
                className="sc-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={busy}
              />
            </label>
            <TurnstileWidget onToken={onTurnstileToken} />
            <button className="sc-btn" type="submit" disabled={busy}>
              {busy ? t("login.submitting") : t("login.submit")}
            </button>
            <OAuthProviders mode="login" returnTo={returnTo} />
            <div className="cc-oauth cc-magic-link">
              <div className="cc-oauth__divider" role="separator" aria-label={t("login.magic.divider")}>
                <span className="cc-oauth__divider-line" />
                <span className="cc-oauth__divider-label">{t("login.magic.divider")}</span>
                <span className="cc-oauth__divider-line" />
              </div>
              <p className="sc-body-sm cc-magic-link__hint">{t("login.magic.hint")}</p>
              <button
                type="button"
                className="cc-oauth__btn cc-magic-link__btn"
                disabled={busy || !loginId.trim()}
                onClick={async () => {
                  setError("");
                  try {
                    setBusy(true);
                    const res = await api.requestMagicLink(loginId.trim());
                    setError(res.devMagicUrl ? `Dev link: ${res.devMagicUrl}` : res.message);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : t("login.magic.failed"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <i className="ph ph-envelope-simple" aria-hidden="true" />
                <span>{t("login.magic.send")}</span>
              </button>
            </div>
            <p className="sc-body-sm">
              <Link to={`/forgot-password${returnTo !== "/profile" ? `?return=${encodeURIComponent(returnTo)}` : ""}`}>
                {t("login.forgot")}
              </Link>
              {" · "}
              <Link to={`/register?return=${encodeURIComponent(returnTo)}`}>{t("login.createAccount")}</Link>
            </p>
          </form>
        </article>
      </div>
    </Page>
  );
}
