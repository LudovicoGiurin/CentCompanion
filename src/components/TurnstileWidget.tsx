import { useEffect, useRef, useId } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../hooks/useTheme";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

export function isTurnstileEnabled(): boolean {
  return SITE_KEY.length > 0;
}

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    window.onTurnstileLoad = () => resolve();
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      if (window.turnstile) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

type Props = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  className?: string;
};

export function TurnstileWidget({ onToken, onExpire, className = "" }: Props) {
  const { t } = useTranslation("common");
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const reactId = useId();

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (token) => onToken(token),
          "expired-callback": () => {
            onToken("");
            onExpire?.();
          },
          "error-callback": () => {
            onToken("");
            onExpire?.();
          },
        });
      })
      .catch(() => {
        onToken("");
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken, onExpire, reactId, theme]);

  if (!SITE_KEY) return null;

  return (
    <div
      ref={containerRef}
      className={`cc-turnstile ${className}`.trim()}
      aria-label={t("securityCheck.aria")}
    />
  );
}
