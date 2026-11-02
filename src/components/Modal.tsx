import { useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../hooks/useReducedMotion";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
};

export function Modal({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  busy = false,
  confirmDisabled = false,
}: ModalProps) {
  const { t } = useTranslation("common");
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmText = confirmLabel ?? t("actions.confirm");
  const cancelText = cancelLabel ?? t("actions.cancel");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cc-modal-backdrop"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          onClick={onCancel}
        >
          <motion.div
            ref={dialogRef}
            className="cc-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-modal-title"
            tabIndex={-1}
            initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: [0, 0.8, 0.26, 0.99] }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cc-modal-title" className="sc-headline-md">
              {title}
            </h3>
            <div className="cc-modal__body">{children}</div>
            <div className="cc-modal__actions">
              <button
                className="sc-btn sc-btn--ghost sc-btn--sm"
                type="button"
                onClick={onCancel}
                disabled={busy}
              >
                {cancelText}
              </button>
              <button
                className={`sc-btn sc-btn--sm${confirmVariant === "danger" ? " sc-btn--danger" : ""}`}
                type="button"
                onClick={onConfirm}
                disabled={busy || confirmDisabled}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type PromptModalProps = {
  open: boolean;
  title: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  required?: boolean;
};

export function PromptModal({
  open,
  title,
  label,
  value,
  onChange,
  onConfirm,
  onCancel,
  confirmLabel,
  required = true,
}: PromptModalProps) {
  const { t } = useTranslation("common");
  return (
    <Modal
      open={open}
      title={title}
      confirmLabel={confirmLabel ?? t("actions.save")}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmDisabled={required && !value.trim()}
    >
      <label className="sc-field">
        <span className="sc-field__label">{label}</span>
        <input
          className="sc-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      </label>
    </Modal>
  );
}
