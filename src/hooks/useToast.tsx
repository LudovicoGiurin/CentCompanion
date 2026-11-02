import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="cc-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`cc-toast cc-toast--${item.variant}`}
            role="status"
          >
            <span>{item.message}</span>
            <button
              type="button"
              className="cc-toast__close"
              aria-label={t("actions.dismiss")}
              onClick={() => dismiss(item.id)}
            >
              <i className="ph ph-x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
