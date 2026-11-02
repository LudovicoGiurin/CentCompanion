import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, setToken } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { Page } from "../components/Motion";
import { SigningInScreen } from "../components/SigningInScreen";

export function MagicLoginPage() {
  const { t } = useTranslation("auth");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError(t("signingIn.missingToken"));
      return;
    }
    void api
      .consumeMagicLink(token)
      .then(async (res) => {
        setToken(res.token);
        await refresh();
        navigate("/profile", { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("login.failed")));
  }, [params, navigate, refresh, t]);

  return (
    <Page>
      <SigningInScreen
        title={t("signingIn.magic")}
        error={error || null}
        errorAction={
          <Link to="/login" className="sc-btn" style={{ marginTop: 12 }}>
            {t("signingIn.backToLogin")}
          </Link>
        }
      />
    </Page>
  );
}
