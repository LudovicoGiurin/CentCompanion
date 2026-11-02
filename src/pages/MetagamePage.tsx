import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type MetagameDeck } from "../lib/api";
import { FadeIn, Page, QuestBar } from "../components/Motion";

export function MetagamePage() {
  const { t } = useTranslation("common");
  const [decks, setDecks] = useState<MetagameDeck[]>([]);

  useEffect(() => {
    api
      .getMetagame()
      .then((d) => setDecks(d.decks))
      .catch(() => {});
  }, []);

  const maxShare = Math.max(...decks.map((d) => d.metaShare), 1);

  return (
    <Page>
      <section className="cc-section">
        <div className="sc-container">
          <div className="cc-h">
            <div>
              <h2 style={{ marginTop: 12 }}>{t("metagame.title")}</h2>
            </div>
          </div>

          <article className="sc-card">
            {decks.length === 0 ? (
              <p>{t("metagame.empty")}</p>
            ) : (
              decks.map((deck, i) => (
                <FadeIn key={deck.id} delay={i * 0.05}>
                  <div className="cc-meta-row">
                    <div>
                      <div className="cc-meta-row__name">{deck.name}</div>
                      <span className="sc-chip" style={{ marginTop: 4 }}>
                        {t("metagame.tier", { tier: deck.tier })}
                      </span>
                    </div>
                    <QuestBar
                      label={deck.archetype}
                      value={deck.metaShare}
                      max={maxShare}
                      variant={deck.tier === "S" ? "gold" : "primary"}
                    />
                    <span className="sc-body-md" style={{ textAlign: "right" }}>
                      {t("metagame.winRate", { n: deck.winRate })}
                    </span>
                  </div>
                </FadeIn>
              ))
            )}
          </article>
        </div>
      </section>
    </Page>
  );
}
