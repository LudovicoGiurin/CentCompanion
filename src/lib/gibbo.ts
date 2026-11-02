import i18n from "../i18n";

export const GIBBO_STORAGE_KEY = "cc_gibbo_dashboard_done";
export const GIBBO_REPLAY_KEY = "cc_gibbo_replay";

export type GibboStep = {
  id: string;
  title: string;
  body: string;
  /** CSS selector for spotlight target; omit for intro step */
  target?: string;
};

export function getDashboardGibboSteps(): GibboStep[] {
  return [
    {
      id: "welcome",
      title: i18n.t("gibbo:welcome.title"),
      body: i18n.t("gibbo:welcome.body"),
    },
    {
      id: "standings",
      title: i18n.t("gibbo:standings.title"),
      body: i18n.t("gibbo:standings.body"),
      target: '[data-gibbo="standings"]',
    },
    {
      id: "my-events",
      title: i18n.t("gibbo:myEvents.title"),
      body: i18n.t("gibbo:myEvents.body"),
      target: '[data-gibbo="my-events"]',
    },
    {
      id: "settings",
      title: i18n.t("gibbo:settings.title"),
      body: i18n.t("gibbo:settings.body"),
      target: '[data-gibbo="settings-link"]',
    },
    {
      id: "done",
      title: i18n.t("gibbo:finish.title"),
      body: i18n.t("gibbo:finish.body"),
    },
  ];
}

export function isGibboDashboardDone(): boolean {
  try {
    return localStorage.getItem(GIBBO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function completeGibboDashboard(): void {
  try {
    localStorage.setItem(GIBBO_STORAGE_KEY, "1");
    localStorage.removeItem(GIBBO_REPLAY_KEY);
  } catch {
    /* ignore */
  }
}

export function requestGibboReplay(): void {
  try {
    localStorage.removeItem(GIBBO_STORAGE_KEY);
    localStorage.setItem(GIBBO_REPLAY_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeGibboReplay(): void {
  try {
    localStorage.removeItem(GIBBO_REPLAY_KEY);
  } catch {
    /* ignore */
  }
}

export function isGibboReplayRequested(): boolean {
  try {
    return localStorage.getItem(GIBBO_REPLAY_KEY) === "1";
  } catch {
    return false;
  }
}

export function shouldShowGibboDashboard(): boolean {
  return !isGibboDashboardDone() || isGibboReplayRequested();
}
