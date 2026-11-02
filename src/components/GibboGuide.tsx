import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { GibboStep } from "../lib/gibbo";
import { completeGibboDashboard } from "../lib/gibbo";
import { GibboSprite } from "./GibboSprite";

type Spotlight = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type Props = {
  steps: GibboStep[];
  open: boolean;
  onClose: () => void;
};

export function GibboGuide({ steps, open, onClose }: Props) {
  const { t } = useTranslation("gibbo");
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;
  const isIntro = !step?.target;

  const updateSpotlight = useCallback(() => {
    if (!open || !step?.target) {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setSpotlight(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    const rect = el.getBoundingClientRect();
    const pad = 8;
    setSpotlight({
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });
  }, [open, step?.target]);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setSpotlight(null);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updateSpotlight();
    const onResize = () => updateSpotlight();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, stepIndex, updateSpotlight]);

  const dismiss = useCallback(() => {
    completeGibboDashboard();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const next = () => {
    if (isLast) dismiss();
    else setStepIndex((i) => i + 1);
  };

  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  if (!open || !step) return null;

  return createPortal(
    <div className="cc-gibbo" role="dialog" aria-modal="true" aria-labelledby="gibbo-title">
      <div className="cc-gibbo__backdrop" aria-hidden onClick={dismiss} />
      {spotlight && (
        <div
          className="cc-gibbo__spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden
        />
      )}

      <div className={`cc-gibbo__panel${isIntro || !spotlight ? " cc-gibbo__panel--centered" : ""}`}>
        <div className="cc-gibbo__mascot-wrap">
          <GibboSprite />
        </div>
        <div className="cc-gibbo__bubble">
          <p className="cc-gibbo__kicker">{t("kicker")}</p>
          <h2 id="gibbo-title" className="cc-gibbo__title">
            {step.title}
          </h2>
          <p className="cc-gibbo__body">{step.body}</p>
          <div className="cc-gibbo__dots" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.id} className={`cc-gibbo__dot${i === stepIndex ? " cc-gibbo__dot--active" : ""}`} />
            ))}
          </div>
          <div className="cc-gibbo__actions">
            <button type="button" className="sc-btn sc-btn--ghost sc-btn--sm" onClick={dismiss}>
              {t("skip")}
            </button>
            <div className="cc-gibbo__actions-main">
              {stepIndex > 0 && (
                <button type="button" className="sc-btn sc-btn--secondary sc-btn--sm" onClick={back}>
                  {t("back")}
                </button>
              )}
              <button type="button" className="sc-btn sc-btn--sm" onClick={next}>
                {isLast ? t("done") : t("next")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
