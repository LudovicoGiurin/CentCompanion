import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { formatUserName } from "../lib/api";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { PrivacyBanner } from "./PrivacyBanner";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PRIVACY_CONTACT_EMAIL } from "../lib/legal";

const NAV_ICONS: Record<string, string> = {
  "/": "ph-house",
  "/events": "ph-calendar-star",
  "/join": "ph-hash",
  "/rules": "ph-scroll",
  "/banlist": "ph-prohibit",
  "/leaderboard": "ph-trophy",
  "/admin": "ph-shield-check",
  "/organizer": "ph-storefront",
  "/profile": "ph-user-circle",
  "/login": "ph-sign-in",
  "/register": "ph-sword",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("common");
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const reduced = useReducedMotion();
  const menuRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  const links = [
    { to: "/", label: t("nav.home"), short: t("nav.home") },
    { to: "/events", label: t("nav.events"), short: t("nav.events") },
    { to: "/join", label: t("nav.joinEvent"), short: t("nav.joinShort") },
    { to: "/rules", label: t("nav.rules"), short: t("nav.rules") },
    { to: "/banlist", label: t("nav.banlist"), short: t("nav.banlist") },
    {
      to: "/leaderboard",
      label: t("nav.leaderboard"),
      short: t("nav.leaderboard"),
    },
  ];

  if (user?.role === "admin") {
    links.push({ to: "/admin", label: t("nav.admin"), short: t("nav.admin") });
  }
  if (user && (user.role === "coordinator" || user.role === "admin")) {
    links.push({
      to: "/organizer",
      label: t("nav.organizer"),
      short: t("nav.organizer"),
    });
  }
  if (user) {
    links.push({
      to: "/profile",
      label: t("nav.profile"),
      short: t("nav.profile"),
    });
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const firstLink = menuRef.current?.querySelector("a, button");
    if (firstLink instanceof HTMLElement) firstLink.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const drawer = (
    <AnimatePresence>
      {menuOpen && (
        <>
          <motion.button
            key="drawer-backdrop"
            type="button"
            className="cc-drawer__backdrop"
            aria-label={t("nav.closeMenu")}
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduced ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={closeMenu}
          />
          <motion.aside
            key="drawer-panel"
            id="cc-mobile-menu"
            ref={menuRef}
            className="cc-drawer cc-mobile-menu is-open"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.mainMenu")}
            initial={{ x: reduced ? 0 : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: reduced ? 0 : "100%" }}
            transition={{
              duration: reduced ? 0 : 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="cc-drawer__head">
              <span className="cc-drawer__title">{t("nav.menu")}</span>
              <button
                type="button"
                className="cc-drawer__close"
                aria-label={t("nav.closeMenu")}
                onClick={closeMenu}
              >
                <i className="ph ph-x" aria-hidden="true" />
              </button>
            </div>

            <nav className="cc-drawer__nav" aria-label={t("nav.mobile")}>
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className="cc-drawer__link"
                  onClick={closeMenu}
                >
                  <i
                    className={`ph ${NAV_ICONS[l.to] ?? "ph-caret-right"}`}
                    aria-hidden="true"
                  />
                  <span>{l.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="cc-drawer__foot">
              <LanguageSwitcher variant="drawer" />
              <button
                className="cc-drawer__link cc-drawer__link--action"
                type="button"
                onClick={toggleTheme}
              >
                <i
                  className={`ph ${theme === "dark" ? "ph-sun" : "ph-moon"}`}
                  aria-hidden="true"
                />
                <span>
                  {theme === "dark" ? t("theme.lightMode") : t("theme.darkMode")}
                </span>
              </button>

              {user ? (
                <>
                  <div className="cc-drawer__user">
                    <i className="ph ph-user" aria-hidden="true" />
                    <span>{formatUserName(user)}</span>
                  </div>
                  <button
                    className="cc-drawer__link cc-drawer__link--action"
                    type="button"
                    onClick={() => {
                      closeMenu();
                      logout();
                    }}
                  >
                    <i className="ph ph-sign-out" aria-hidden="true" />
                    <span>{t("nav.logOut")}</span>
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    to="/login"
                    className="cc-drawer__link"
                    onClick={closeMenu}
                  >
                    <i className="ph ph-sign-in" aria-hidden="true" />
                    <span>{t("nav.logIn")}</span>
                  </NavLink>
                  <NavLink
                    to="/register"
                    className="cc-drawer__link cc-drawer__link--primary"
                    onClick={closeMenu}
                  >
                    <i className="ph ph-sword" aria-hidden="true" />
                    <span>{t("nav.joinCta")}</span>
                  </NavLink>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <a href="#main-content" className="cc-skip-link">
        {t("nav.skipToContent")}
      </a>
      <PrivacyBanner />
      <nav className="cc-nav" aria-label={t("nav.primary")}>
        <div className="cc-nav__inner">
          <Link to="/" className="cc-logo">
            <img
              src="/logo.jpg"
              alt=""
              className="cc-logo__icon"
              width={36}
              height={36}
            />
            <span className="cc-logo__text cc-logo__text--full">
              {t("brand.full")}
            </span>
            <span className="cc-logo__text cc-logo__text--short">
              {t("brand.short")}
            </span>
          </Link>

          <div className="cc-nav__links">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className="cc-nav__link"
                title={l.label}
              >
                {({ isActive }) => (
                  <>
                    {isActive && !reduced && (
                      <motion.span
                        layoutId="cc-nav-indicator"
                        className="cc-nav__indicator"
                        transition={{
                          duration: 0.22,
                          ease: [0, 0.8, 0.26, 0.99],
                        }}
                      />
                    )}
                    <i
                      className={`ph ${NAV_ICONS[l.to] ?? "ph-caret-right"} cc-nav__link-icon`}
                      aria-hidden="true"
                    />
                    <span className="cc-nav__link-label">{l.short}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="cc-nav__actions">
            <div className="cc-nav__cta">
              <LanguageSwitcher
                variant="drawer"
                className="cc-nav__lang cc-nav__theme-btn cc-nav__theme-btn--top"
              />
              <button
                className="sc-btn sc-btn--ghost sc-btn--sm cc-nav__theme-btn cc-nav__theme-btn--top"
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark"
                    ? t("theme.switchToLight")
                    : t("theme.switchToDark")
                }
                title={
                  theme === "dark"
                    ? t("theme.switchToLight")
                    : t("theme.switchToDark")
                }
              >
                <i
                  className={`ph ${theme === "dark" ? "ph-sun" : "ph-moon"}`}
                  aria-hidden="true"
                />
                <span className="cc-nav__btn-label">
                  {theme === "dark" ? t("theme.light") : t("theme.dark")}
                </span>
              </button>
              {user ? (
                <>
                  <span className="sc-chip sc-chip--primary sc-btn--sm cc-nav__user-chip">
                    <i className="ph ph-user" aria-hidden="true" />
                    <span className="cc-nav__btn-label">{formatUserName(user)}</span>
                  </span>
                  <button
                    className="sc-btn sc-btn--ghost sc-btn--sm"
                    type="button"
                    onClick={logout}
                  >
                    <i className="ph ph-sign-out" aria-hidden="true" />
                    <span className="cc-nav__btn-label">{t("nav.logOut")}</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="sc-btn sc-btn--ghost sc-btn--sm cc-nav__auth-btn"
                  >
                    <i
                      className="ph ph-sign-in cc-nav__auth-icon"
                      aria-hidden="true"
                    />
                    <span className="cc-nav__btn-label">{t("nav.logIn")}</span>
                  </Link>
                  <Link
                    to="/register"
                    className="sc-btn sc-btn--sm cc-nav__auth-btn"
                  >
                    <i
                      className="ph ph-sword cc-nav__auth-icon"
                      aria-hidden="true"
                    />
                    <span className="cc-nav__btn-label">{t("nav.joinCta")}</span>
                  </Link>
                </>
              )}
            </div>

            <button
              ref={burgerRef}
              className="cc-nav__burger"
              type="button"
              aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={menuOpen}
              aria-controls="cc-mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <i className={`ph ph-${menuOpen ? "x" : "list"}`} />
            </button>
          </div>
        </div>
      </nav>

      {typeof document !== "undefined"
        ? createPortal(drawer, document.body)
        : null}

      <main id="main-content" className="cc-main">
        {children}
      </main>

      <footer className="cc-foot">
        <div className="sc-container cc-foot__row">
          <span>{t("footer.copyright")}</span>
          <div className="cc-foot__links">
            <Link to="/privacy">{t("footer.privacy")}</Link>
            <Link to="/terms">{t("footer.terms")}</Link>
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{t("footer.contact")}</a>
            <a
              href="https://www.centurioncommander.eu"
              target="_blank"
              rel="noreferrer"
            >
              {t("footer.officialSite")}
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
