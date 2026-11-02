import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  title?: string;
  error?: string | null;
  errorAction?: ReactNode;
  action?: ReactNode;
};

export function SigningInScreen({ title, error, errorAction, action }: Props) {
  const { t } = useTranslation("auth");
  const funnyLines = useMemo(
    () => Array.from({ length: 12 }, (_, i) => t(`signingIn.line.${i}`)),
    [t],
  );
  const [lineIndex, setLineIndex] = useState(0);
  const [progress, setProgress] = useState(12);
  const displayTitle = title ?? t("signingIn.title");

  useEffect(() => {
    if (error) return;
    const lineTimer = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % funnyLines.length);
    }, 2200);
    const progressTimer = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? 18 : p + 7 + Math.floor(Math.random() * 8)));
    }, 400);
    return () => {
      window.clearInterval(lineTimer);
      window.clearInterval(progressTimer);
    };
  }, [error, funnyLines.length]);

  if (error) {
    return (
      <div className="cc-auth">
        <article className="sc-card cc-signing-in cc-signing-in--error">
          <div className="cc-signing-in__icon" aria-hidden="true">
            <i className="ph ph-warning-circle" />
          </div>
          <h1 className="sc-card__title">{t("signingIn.errorTitle")}</h1>
          <div className="cc-alert cc-alert--error">{error}</div>
          {errorAction}
        </article>
      </div>
    );
  }

  return (
    <div className="cc-auth">
      <article className="sc-card cc-signing-in" aria-busy="true" aria-live="polite">
        <div className="cc-signing-in__icon cc-signing-in__icon--spin" aria-hidden="true">
          <i className="ph ph-circle-notch" />
        </div>
        <h1 className="sc-card__title">{displayTitle}</h1>
        <p className="cc-signing-in__status" key={lineIndex}>
          {funnyLines[lineIndex]}
        </p>
        <div
          className="cc-signing-in__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={t("signingIn.aria")}
        >
          <div className="cc-signing-in__bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="cc-signing-in__hint">{t("signingIn.hint")}</p>
        {action}
      </article>
    </div>
  );
}
