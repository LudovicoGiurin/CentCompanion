import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Page } from "../components/Motion";
import { PRIVACY_CONTACT_EMAIL, SITE_NAME, SITE_URL } from "../lib/legal";

function linkedPhrase(full: string, phrase: string, to: string) {
  const i = full.indexOf(phrase);
  if (i < 0) {
    return (
      <>
        {full} <Link to={to}>{phrase}</Link>
      </>
    );
  }
  return (
    <>
      {full.slice(0, i)}
      <Link to={to}>{phrase}</Link>
      {full.slice(i + phrase.length)}
    </>
  );
}

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTranslation("legal");
  return (
    <Page>
      <section className="cc-section">
        <div className="sc-container cc-legal">
          <p className="sc-body-sm">
            <Link to="/">{t("home")}</Link>
          </p>
          <h1 className="sc-headline-lg">{title}</h1>
          <p className="sc-body-sm cc-legal__updated">{t("updated")}</p>
          <article className="sc-card cc-legal__body">{children}</article>
        </div>
      </section>
    </Page>
  );
}

export function PrivacyPage() {
  const { t } = useTranslation("legal");
  const vars = { siteName: SITE_NAME, siteUrl: SITE_URL, email: PRIVACY_CONTACT_EMAIL };

  return (
    <LegalLayout title={t("privacy.title")}>
      <p>{t("privacy.intro", vars)}</p>

      <h2>{t("privacy.h.controller")}</h2>
      <p>{t("privacy.controller.body", vars)}</p>

      <h2>{t("privacy.h.collect")}</h2>
      <ul>
        <li>
          <strong>{t("privacy.collect.accountLabel")}</strong> {t("privacy.collect.account")}
        </li>
        <li>
          <strong>{t("privacy.collect.eventLabel")}</strong> {t("privacy.collect.event")}
        </li>
        <li>
          <strong>{t("privacy.collect.guestLabel")}</strong> {t("privacy.collect.guest")}
        </li>
        <li>
          <strong>{t("privacy.collect.coordinatorLabel")}</strong> {t("privacy.collect.coordinator")}
        </li>
        <li>
          <strong>{t("privacy.collect.technicalLabel")}</strong> {t("privacy.collect.technical")}
        </li>
      </ul>

      <h2>{t("privacy.h.bases")}</h2>
      <ul>
        <li>
          <strong>{t("privacy.bases.contractLabel")}</strong> {t("privacy.bases.contract")}
        </li>
        <li>
          <strong>{t("privacy.bases.legitimateLabel")}</strong> {t("privacy.bases.legitimate")}
        </li>
        <li>
          <strong>{t("privacy.bases.consentLabel")}</strong> {t("privacy.bases.consent")}
        </li>
        <li>
          <strong>{t("privacy.bases.legalLabel")}</strong> {t("privacy.bases.legal")}
        </li>
      </ul>

      <h2>{t("privacy.h.processors")}</h2>
      <p>{t("privacy.processors.intro")}</p>
      <ul>
        <li>{t("privacy.processors.cloudflare")}</li>
        <li>{t("privacy.processors.neon")}</li>
        <li>{t("privacy.processors.resend")}</li>
        <li>{t("privacy.processors.osm")}</li>
      </ul>
      <p>{t("privacy.processors.noSell")}</p>

      <h2>{t("privacy.h.retention")}</h2>
      <ul>
        <li>{t("privacy.retention.account")}</li>
        <li>{t("privacy.retention.guest")}</li>
        <li>{t("privacy.retention.tournament")}</li>
        <li>{t("privacy.retention.verify")}</li>
        <li>{t("privacy.retention.reset")}</li>
      </ul>

      <h2>{t("privacy.h.rights")}</h2>
      <p>{t("privacy.rights.intro")}</p>
      <ul>
        <li>{t("privacy.rights.access")}</li>
        <li>{t("privacy.rights.rectify")}</li>
        <li>{t("privacy.rights.erase")}</li>
        <li>{t("privacy.rights.restrict")}</li>
        <li>{t("privacy.rights.portability")}</li>
        <li>{t("privacy.rights.withdraw")}</li>
        <li>{t("privacy.rights.complaint")}</li>
      </ul>

      <h2>{t("privacy.h.children")}</h2>
      <p>{t("privacy.children.body")}</p>

      <h2>{t("privacy.h.cookies")}</h2>
      <p>{linkedPhrase(t("privacy.cookies.body"), t("privacy.cookies.termsLink"), "/terms")}</p>

      <h2>{t("privacy.h.changes")}</h2>
      <p>{t("privacy.changes.body")}</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  const { t } = useTranslation("legal");
  const vars = { siteName: SITE_NAME, siteUrl: SITE_URL, email: PRIVACY_CONTACT_EMAIL };

  return (
    <LegalLayout title={t("terms.title")}>
      <p>{t("terms.intro", vars)}</p>

      <h2>{t("terms.h.accounts")}</h2>
      <ul>
        <li>{t("terms.accounts.accurate")}</li>
        <li>{t("terms.accounts.verify")}</li>
        <li>{t("terms.accounts.onePerson")}</li>
        <li>{t("terms.accounts.suspend")}</li>
      </ul>

      <h2>{t("terms.h.events")}</h2>
      <ul>
        <li>{t("terms.events.organizers")}</li>
        <li>{t("terms.events.names")}</li>
        <li>{t("terms.events.guests")}</li>
      </ul>

      <h2>{t("terms.h.acceptable")}</h2>
      <p>{t("terms.acceptable.intro")}</p>
      <ul>
        <li>{t("terms.acceptable.attack")}</li>
        <li>{t("terms.acceptable.upload")}</li>
        <li>{t("terms.acceptable.circumvent")}</li>
      </ul>

      <h2>{t("terms.h.disclaimer")}</h2>
      <p>{t("terms.disclaimer.body")}</p>

      <h2>{t("terms.h.privacy")}</h2>
      <p>{linkedPhrase(t("terms.privacy.body"), t("terms.privacy.link"), "/privacy")}</p>

      <h2>{t("terms.h.contact")}</h2>
      <p>{t("terms.contact.body", { email: PRIVACY_CONTACT_EMAIL })}</p>
    </LegalLayout>
  );
}
