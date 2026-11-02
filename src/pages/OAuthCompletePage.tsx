import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { setToken } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { resolveReturnPath } from "../lib/authReturn";
import { Page } from "../components/Motion";
import { SigningInScreen } from "../components/SigningInScreen";

function appDeepLink(token: string, returnTo: string): string {
  const params = new URLSearchParams({ token, return: returnTo });
  return `centcomp://oauth/complete?${params.toString()}`;
}

function isMobileBrowser(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function OAuthCompletePage() {
  const { t } = useTranslation("auth");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [appLink, setAppLink] = useState<string | null>(null);

  const token = params.get("token");
  const native = params.get("native") === "1";
  const returnTo = useMemo(
    () => resolveReturnPath(params.get("return"), "/profile"),
    [params],
  );

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const completeOnWeb = () => {
      setToken(token);
      void refresh().then(() => {
        navigate(returnTo.startsWith("/") ? returnTo : "/profile", { replace: true });
      });
    };

    const openInApp = native || isMobileBrowser();
    if (openInApp) {
      const link = appDeepLink(token, returnTo);
      setAppLink(link);
      window.location.replace(link);
      if (native) return;
      const timer = window.setTimeout(completeOnWeb, 1800);
      return () => window.clearTimeout(timer);
    }

    completeOnWeb();
  }, [token, native, returnTo, navigate, refresh]);

  return (
    <Page>
      <SigningInScreen
        title={t("signingIn.title")}
        action={
          appLink ? (
            <p className="cc-signing-in__hint" style={{ marginTop: 16 }}>
              <a className="sc-btn" href={appLink}>
                {t("signingIn.openApp")}
              </a>
            </p>
          ) : null
        }
      />
    </Page>
  );
}
