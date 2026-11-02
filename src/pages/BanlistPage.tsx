import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatAppDateTime } from "../lib/formatLocale";
import { normalizeContentHtml } from "../../shared/normalizeContentHtml";
import { Page, TabPanel } from "../components/Motion";
import { SkeletonCard } from "../components/Skeleton";

export function BanlistPage() {
  const { t } = useTranslation("common");
  const [banlistHtml, setBanlistHtml] = useState("");
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const displayHtml = useMemo(
    () => normalizeContentHtml(banlistHtml, "https://www.centurioncommander.eu/ban-list/"),
    [banlistHtml],
  );

  useEffect(() => {
    api
      .getRules()
      .then((d) => {
        setBanlistHtml(d.banlist.contentHtml);
        setSyncedAt(d.banlist.syncedAt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const linkLabel = t("banlist.linkLabel");
  const footer = t("banlist.footer");
  const linkIdx = footer.indexOf(linkLabel);

  return (
    <Page>
      <section className="cc-section">
        <div className="sc-container">
          <div className="cc-h">
            <div>
              <h2 style={{ marginTop: 12 }}>{t("banlist.title")}</h2>
            </div>
            {syncedAt && (
              <span className="sc-micro">
                {t("rules.lastSynced", { date: formatAppDateTime(syncedAt) })}
              </span>
            )}
          </div>

          <TabPanel id="banlist-content" active>
            {loading ? (
              <SkeletonCard />
            ) : (
              <article className="sc-card sc-card--scroll">
                <div
                  className="cc-rules-content"
                  dangerouslySetInnerHTML={{ __html: displayHtml }}
                />
              </article>
            )}
          </TabPanel>

          <p
            className="sc-body-sm"
            style={{ marginTop: 16, color: "var(--sc-muted)" }}
          >
            {linkIdx < 0 ? (
              footer
            ) : (
              <>
                {footer.slice(0, linkIdx)}
                <a
                  href="https://www.centurioncommander.eu/ban-list/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {linkLabel}
                </a>
                {footer.slice(linkIdx + linkLabel.length)}
              </>
            )}
          </p>
        </div>
      </section>
    </Page>
  );
}
