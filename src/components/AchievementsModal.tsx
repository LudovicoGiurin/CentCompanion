import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { ACHIEVEMENTS } from "../../shared/achievements";
import { useReducedMotion } from "../hooks/useReducedMotion";

type Props = {
  open: boolean;
  earnedCodes: Set<string>;
  equippedFrame: string | null;
  busy?: boolean;
  /** When true, medals are display-only (no equip). */
  readOnly?: boolean;
  onEquip: (frame: string, isEarned: boolean) => void;
  onClose: () => void;
};

/**
 * Full achievement gallery: unlocked medals in color, locked in gray.
 * Tapping an unlocked medal equips its avatar frame (unless readOnly).
 */
export function AchievementsModal({
  open,
  earnedCodes,
  equippedFrame,
  busy = false,
  readOnly = false,
  onEquip,
  onClose,
}: Props) {
  const { t } = useTranslation(["dashboard", "common"]);
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cc-modal-backdrop"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            className="cc-modal cc-achievements-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-achievements-title"
            tabIndex={-1}
            initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: [0, 0.8, 0.26, 0.99] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cc-achievements-modal__head">
              <h3 id="cc-achievements-title" className="sc-headline-md">
                <i className="ph ph-trophy" aria-hidden="true" /> {t("profile.achievementsTitle")}
              </h3>
              <button
                type="button"
                className="cc-profile-card__icon-btn"
                onClick={onClose}
                aria-label={t("common:actions.dismiss")}
                title={t("common:actions.dismiss")}
              >
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>

            <p className="cc-achievements-modal__hint">
              {readOnly ? t("profile.achievementsViewHint") : t("profile.achievementsEquipHint")}
            </p>

            <ul className="cc-achievements-list">
              {ACHIEVEMENTS.map((a) => {
                const isEarned = earnedCodes.has(a.code);
                const isEquipped = isEarned && equippedFrame === a.frame;
                const name = t(`profile.achievements.${a.code}.name`);
                const desc = t(`profile.achievements.${a.code}.desc`);
                const canEquip = !readOnly && isEarned;
                return (
                  <li key={a.code}>
                    <button
                      type="button"
                      className={[
                        "cc-achievement-row",
                        `cc-achievement-row--${a.frame}`,
                        isEarned ? "cc-achievement-row--earned" : "cc-achievement-row--locked",
                        isEquipped ? "cc-achievement-row--equipped" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={!canEquip || busy}
                      onClick={() => {
                        if (canEquip) onEquip(a.frame, isEarned);
                      }}
                      aria-pressed={isEquipped}
                    >
                      <span className={`cc-medal cc-medal--${a.frame} ${isEarned ? "cc-medal--earned" : "cc-medal--locked"}`}>
                        <i className={`ph ph-${isEarned ? a.icon : "lock-simple"}`} aria-hidden="true" />
                      </span>
                      <span className="cc-achievement-row__text">
                        <strong>{name}</strong>
                        <span>{desc}</span>
                        {isEquipped && (
                          <span className="cc-achievement-row__badge">{t("profile.frameEquipped")}</span>
                        )}
                        {!isEarned && (
                          <span className="cc-achievement-row__badge cc-achievement-row__badge--locked">
                            {t("profile.locked")}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
