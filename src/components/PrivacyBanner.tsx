import { useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { hasPrivacyConsent, setPrivacyConsent } from "../lib/privacyConsent";

export function PrivacyBanner() {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(() => !hasPrivacyConsent());

  if (!visible) return null;

  const accept = () => {
    setPrivacyConsent();
    setVisible(false);
    window.dispatchEvent(new Event("cc-privacy-consent"));
  };

  return (
    <aside className="cc-privacy-banner" role="dialog" aria-label={t("privacy.banner.aria")}>
      <div className="cc-privacy-banner__inner sc-container">
        <p className="cc-privacy-banner__text">
          <Trans
            i18nKey="privacy.banner.body"
            ns="common"
            components={{ privacyLink: <Link to="/privacy" /> }}
          />
        </p>
        <button type="button" className="sc-btn sc-btn--sm" onClick={accept}>
          {t("privacy.banner.accept")}
        </button>
      </div>
    </aside>
  );
}
