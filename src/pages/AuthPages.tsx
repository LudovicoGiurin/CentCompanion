import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Page } from "../components/Motion";
import { isTurnstileEnabled, TurnstileWidget } from "../components/TurnstileWidget";

export function VerifyEmailPage() {
  const { t } = useTranslation(["auth", "common"]);
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage(t("verify.missingToken"));
      return;
    }
    api.verifyEmail(token)
      .then((d) => { setStatus("ok"); setMessage(d.message); })
      .catch((e) => { setStatus("error"); setMessage(e.message); });
  }, [params, t]);

  return (
    <Page>
      <div className="cc-auth">
        <article className="sc-card">
          <h1 className="sc-card__title">{t("verify.title")}</h1>
          {status === "loading" && <p>{t("verify.verifying")}</p>}
          {status === "ok" && <div className="cc-alert cc-alert--success">{message}</div>}
          {status === "error" && <div className="cc-alert cc-alert--error">{message}</div>}
          <Link to="/login" className="sc-btn" style={{ marginTop: 16 }}>{t("login.title")}</Link>
        </article>
      </div>
    </Page>
  );
}

export function ResendVerificationPage() {
  const { t } = useTranslation(["auth", "common"]);
  const [params] = useSearchParams();
  const [login, setLogin] = useState(params.get("login") ?? "");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [message, setMessage] = useState("");
  const [devUrl, setDevUrl] = useState("");
  const [error, setError] = useState("");

  const onTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevUrl("");
    if (isTurnstileEnabled() && !turnstileToken) {
      setError(t("common:securityCheck.label"));
      return;
    }
    try {
      const data = await api.resendVerification(login, turnstileToken || undefined);
      setMessage(data.message);
      if (data.devVerifyUrl) setDevUrl(data.devVerifyUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common:errors.generic"));
      setTurnstileToken("");
    }
  };

  return (
    <Page>
      <div className="cc-auth">
        <article className="sc-card">
          <h1 className="sc-card__title">{t("resend.title")}</h1>
          <form className="cc-form" onSubmit={handleSubmit}>
            {error && <div className="cc-alert cc-alert--error">{error}</div>}
            {message && <div className="cc-alert cc-alert--success">{message}</div>}
            {devUrl && (
              <p className="sc-body-sm">
                {t("resend.verifyLink")} <Link to={devUrl.replace(/^https?:\/\/[^/]+/, "")}>{devUrl}</Link>
              </p>
            )}
            <label className="sc-field">
              <span className="sc-field__label">{t("login.emailOrUsername")}</span>
              <input className="sc-input" value={login} onChange={(e) => setLogin(e.target.value)} required />
            </label>
            <TurnstileWidget onToken={onTurnstileToken} />
            <button className="sc-btn" type="submit">{t("resend.submit")}</button>
            <Link to="/login" className="sc-body-sm">{t("resend.back")}</Link>
          </form>
        </article>
      </div>
    </Page>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation(["auth", "common"]);
  const [login, setLogin] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (isTurnstileEnabled() && !turnstileToken) {
      setError(t("common:securityCheck.label"));
      return;
    }
    try {
      const data = await api.forgotPassword(login, turnstileToken || undefined);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common:errors.generic"));
      setTurnstileToken("");
    }
  };

  return (
    <Page>
      <div className="cc-auth">
        <article className="sc-card">
          <h1 className="sc-card__title">{t("forgot.title")}</h1>
          <form className="cc-form" onSubmit={handleSubmit}>
            {error && <div className="cc-alert cc-alert--error">{error}</div>}
            {message && <div className="cc-alert cc-alert--success">{message}</div>}
            <label className="sc-field">
              <span className="sc-field__label">{t("login.emailOrUsername")}</span>
              <input className="sc-input" value={login} onChange={(e) => setLogin(e.target.value)} required />
            </label>
            <TurnstileWidget onToken={onTurnstileToken} />
            <button className="sc-btn" type="submit">{t("forgot.submit")}</button>
          </form>
        </article>
      </div>
    </Page>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = params.get("token");
    if (!token) return setError(t("reset.invalidLink"));
    try {
      const data = await api.resetPassword(token, password);
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("reset.failed"));
    }
  };

  return (
    <Page>
      <div className="cc-auth">
        <article className="sc-card">
          <h1 className="sc-card__title">{t("reset.title")}</h1>
          <form className="cc-form" onSubmit={handleSubmit}>
            {error && <div className="cc-alert cc-alert--error">{error}</div>}
            {message && <div className="cc-alert cc-alert--success">{message}</div>}
            <label className="sc-field">
              <span className="sc-field__label">{t("reset.newPassword")}</span>
              <input className="sc-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </label>
            <button className="sc-btn" type="submit">{t("reset.submit")}</button>
            <Link to="/login" className="sc-body-sm">{t("resend.back")}</Link>
          </form>
        </article>
      </div>
    </Page>
  );
}
