import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useToast } from "../hooks/useToast";
import { Page } from "../components/Motion";
import { usePageMeta } from "../hooks/usePageMeta";

export function JoinPage() {
  const { t } = useTranslation("events");
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [code, setCode] = useState((codeParam ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  const [busy, setBusy] = useState(false);

  usePageMeta({
    title: t("join.metaTitle"),
    description: t("join.metaDesc"),
  });

  const lookup = async (rawCode: string) => {
    const normalized = rawCode.trim().toUpperCase();
    if (normalized.length !== 6) {
      toast(t("join.invalidCode"), "error");
      return;
    }
    setBusy(true);
    try {
      const data = await api.lookupEventByCode(normalized);
      const tab =
        data.event.status === "ongoing" || data.event.status === "completed" ? "tournament" : "overview";
      navigate(`/events/${data.event.id}?tab=${tab}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : t("join.notFound"), "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (codeParam && codeParam.length === 6) void lookup(codeParam);
  }, [codeParam]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void lookup(code);
  };

  const onCodeChange = (value: string) => {
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  };

  const slots = Array.from({ length: 6 }, (_, i) => code[i] ?? "");

  return (
    <Page className="cc-join-page">
      <section className="cc-join sc-section">
        <div className="cc-join-phone">
          <header className="cc-join-phone__hero">
            <p className="cc-join-phone__eyebrow">{t("join.eyebrow")}</p>
            <h1>{t("join.title")}</h1>
          </header>

          <form className="cc-join-phone__form" onSubmit={handleSubmit}>
            <label className="cc-join-phone__field">
              <span className="cc-join-phone__label">{t("join.codeLabel")}</span>
              <div className="cc-join-phone__slots" aria-hidden>
                {slots.map((ch, i) => (
                  <span key={i} className={`cc-join-phone__slot${ch ? " is-filled" : ""}${i === code.length ? " is-active" : ""}`}>
                    {ch || "·"}
                  </span>
                ))}
              </div>
              <input
                className="cc-join-phone__input"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder={t("join.codePlaceholder")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                inputMode="text"
                disabled={busy}
                autoFocus
                aria-label={t("join.codeLabel")}
              />
            </label>
            <button
              className="sc-btn sc-btn--lg cc-join-phone__submit"
              type="submit"
              disabled={busy || code.length !== 6}
            >
              <i className="ph ph-hash" aria-hidden="true" />
              {busy ? t("join.lookingUp") : t("join.submit")}
            </button>
          </form>

          <Link to="/events" className="cc-join-phone__browse">
            {t("join.browse")}
            <i className="ph ph-caret-right" aria-hidden="true" />
          </Link>
        </div>

        <div className="cc-join__card sc-card">
          <h1 className="sc-headline-lg">{t("join.title")}</h1>

          <form className="cc-join__form" onSubmit={handleSubmit}>
            <label className="sc-field">
              <span className="sc-field__label">{t("join.codeLabel")}</span>
              <input
                className="sc-input cc-join__code-input"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder={t("join.codePlaceholder")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                inputMode="text"
                disabled={busy}
              />
            </label>
            <button className="sc-btn cc-join__submit" type="submit" disabled={busy || code.length !== 6}>
              {busy ? t("join.lookingUp") : t("join.submit")}
            </button>
          </form>

          <p className="sc-body-sm cc-join__footer">{t("join.footer")}</p>
        </div>
      </section>
    </Page>
  );
}
