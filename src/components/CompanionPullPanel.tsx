import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CompanionStandingRow, EventItem } from "../lib/api";

type Props = {
  event: EventItem;
  busy?: boolean;
  onPull: (input: {
    wizardsEmail: string;
    wizardsPassword: string;
    companionEventCode: string;
    markCompleted: boolean;
  }) => Promise<{ matchedCount: number; unmatchedCount: number; standings: CompanionStandingRow[] }>;
};

export function CompanionPullPanel({ event, busy = false, onPull }: Props) {
  const { t } = useTranslation("events");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(event.companionEventCode ?? "");
  const [markCompleted, setMarkCompleted] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLastSummary(null);
    setSubmitting(true);
    try {
      const result = await onPull({
        wizardsEmail: email.trim(),
        wizardsPassword: password,
        companionEventCode: code.trim().toUpperCase(),
        markCompleted,
      });
      setLastSummary(
        t("companion.pull.summary", {
          n: result.standings.length,
          m: result.matchedCount,
          u: result.unmatchedCount,
        }),
      );
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("companion.pull.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="sc-card">
      <h3 className="sc-headline-md">{t("companion.pull.title")}</h3>
      <p className="sc-body-sm">{t("companion.pull.body")}</p>
      <form className="cc-form" onSubmit={(e) => void handleSubmit(e)} style={{ marginTop: 12 }}>
        <label className="sc-field">
          <span className="sc-field__label">{t("companion.pull.code")}</span>
          <input
            className="sc-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("companion.pull.codePh")}
            required
            minLength={4}
            maxLength={16}
            autoComplete="off"
            disabled={busy || submitting}
          />
        </label>
        <label className="sc-field">
          <span className="sc-field__label">{t("companion.pull.email")}</span>
          <input
            className="sc-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={busy || submitting}
          />
        </label>
        <label className="sc-field">
          <span className="sc-field__label">{t("companion.pull.password")}</span>
          <input
            className="sc-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={busy || submitting}
          />
        </label>
        <label className="sc-field sc-row" style={{ gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={markCompleted}
            onChange={(e) => setMarkCompleted(e.target.checked)}
            disabled={busy || submitting}
          />
          <span className="sc-body-sm">{t("companion.pull.markDone")}</span>
        </label>
        {error && <div className="cc-alert cc-alert--error">{error}</div>}
        {lastSummary && <div className="cc-alert cc-alert--success">{lastSummary}</div>}
        <button className="sc-btn" type="submit" disabled={busy || submitting}>
          <i className="ph ph-download-simple" />
          {submitting
            ? t("companion.pull.pulling")
            : event.companionLastPulledAt
              ? t("companion.pull.repull")
              : t("companion.pull.submit")}
        </button>
      </form>
    </article>
  );
}
