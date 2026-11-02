import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LOCALE_FLAGS,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type SupportedLocale,
} from "../lib/locales";
import { setAppLocale } from "../i18n";

type Props = {
  className?: string;
  /** Compact popover for desktop nav; expand-in-place for drawer; always-open for settings */
  variant?: "nav" | "settings" | "drawer";
};

function LocaleFlag({ code }: { code: SupportedLocale }) {
  return (
    <span className="cc-lang-switcher__flag" aria-hidden="true">
      {LOCALE_FLAGS[code]}
    </span>
  );
}

function LocaleGrid({
  current,
  onPick,
  id,
  labelledBy,
}: {
  current: SupportedLocale;
  onPick: (code: SupportedLocale) => void;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <div
      className="cc-lang-switcher__grid"
      role="listbox"
      id={id}
      aria-labelledby={labelledBy}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const selected = code === current;
        return (
          <button
            key={code}
            type="button"
            role="option"
            aria-selected={selected}
            className={`cc-lang-switcher__option${selected ? " is-active" : ""}`}
            onClick={() => onPick(code)}
          >
            <LocaleFlag code={code} />
            <span>{LOCALE_LABELS[code]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LanguageSwitcher({ className = "", variant = "nav" }: Props) {
  const { i18n, t } = useTranslation("common");
  const current = normalizeLocale(i18n.language);
  const listId = useId();
  const headingId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const pick = (code: SupportedLocale) => {
    void setAppLocale(code);
    setOpen(false);
  };

  useEffect(() => {
    if (!open || (variant !== "nav" && variant !== "drawer")) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, variant]);

  /* Desktop rail collapses on mouseleave — close language so it doesn't stick open */
  useEffect(() => {
    if (!open || variant !== "drawer") return;
    const nav = rootRef.current?.closest(".cc-nav");
    if (!nav) return;

    const onLeave = () => setOpen(false);
    nav.addEventListener("mouseleave", onLeave);
    return () => nav.removeEventListener("mouseleave", onLeave);
  }, [open, variant]);

  if (variant === "settings") {
    return (
      <div className={`cc-lang-switcher cc-lang-switcher--settings ${className}`.trim()}>
        <div className="cc-lang-switcher__heading" id={headingId}>
          <i className="ph ph-globe" aria-hidden="true" />
          <span className="sc-label">{t("language.label")}</span>
        </div>
        <LocaleGrid current={current} onPick={pick} labelledBy={headingId} />
      </div>
    );
  }

  if (variant === "drawer") {
    return (
      <div
        ref={rootRef}
        className={`cc-lang-switcher cc-lang-switcher--drawer ${className}`.trim()}
      >
        <button
          type="button"
          className="cc-lang-switcher__drawer-toggle"
          id={headingId}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          <i className="ph ph-globe" aria-hidden="true" />
          <span className="cc-lang-switcher__drawer-label">
            <span className="cc-lang-switcher__drawer-title">{t("language.label")}</span>
            <span className="cc-lang-switcher__drawer-current">
              <LocaleFlag code={current} />
              {LOCALE_LABELS[current]}
            </span>
          </span>
          <i
            className={`ph ${open ? "ph-caret-up" : "ph-caret-down"}`}
            aria-hidden="true"
          />
        </button>
        {open && (
          <LocaleGrid
            current={current}
            onPick={pick}
            id={listId}
            labelledBy={headingId}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`cc-lang-switcher cc-lang-switcher--nav ${className}`.trim()}
    >
      <button
        type="button"
        className="cc-lang-switcher__trigger"
        aria-label={t("language.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title={t("language.label")}
        onClick={() => setOpen((v) => !v)}
      >
        <LocaleFlag code={current} />
        <span className="cc-lang-switcher__trigger-label">{LOCALE_LABELS[current]}</span>
        <i className={`ph ${open ? "ph-caret-up" : "ph-caret-down"}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="cc-lang-switcher__panel">
          <LocaleGrid current={current} onPick={pick} id={listId} />
        </div>
      )}
    </div>
  );
}
