import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

function GoogleLogo() {
  return (
    <svg className="cc-oauth__logo" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg className="cc-oauth__logo" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        fill="#5865F2"
        d="M19.3 5.1A17 17 0 0 0 15 3.9l-.3.6a15.4 15.4 0 0 1 3.6 1.4 15.7 15.7 0 0 0-12.6 0A15.4 15.4 0 0 1 9.3 3.9L9 3.9a17 17 0 0 0-4.3 1.2C2.1 9 1.4 12.8 1.7 16.5A17.5 17.5 0 0 0 7 19l.8-1.1a11.4 11.4 0 0 1-1.7-.8l.4-.3a12.3 12.3 0 0 0 11 0l.4.3c-.5.3-1.1.6-1.7.8L17 19a17.4 17.4 0 0 0 5.3-2.5c.4-4.3-.7-8-1.9-11.4ZM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2-.8 2-1.8 2Z"
      />
    </svg>
  );
}

type Props = {
  mode: "login" | "signup";
  returnTo?: string;
};

export function OAuthProviders({ mode, returnTo }: Props) {
  const { t } = useTranslation("auth");
  const label = mode === "login" ? t("oauth.logInWith") : t("oauth.signUpWith");

  return (
    <div className="cc-oauth">
      <div className="cc-oauth__divider" role="separator" aria-label={label}>
        <span className="cc-oauth__divider-line" />
        <span className="cc-oauth__divider-label">{label}</span>
        <span className="cc-oauth__divider-line" />
      </div>
      <div className="cc-oauth__providers">
        <a className="cc-oauth__btn" href={api.oauthStartUrl("google", returnTo)}>
          <GoogleLogo />
          <span>{t("oauth.google")}</span>
        </a>
        <a className="cc-oauth__btn" href={api.oauthStartUrl("discord", returnTo)}>
          <DiscordLogo />
          <span>{t("oauth.discord")}</span>
        </a>
      </div>
    </div>
  );
}
