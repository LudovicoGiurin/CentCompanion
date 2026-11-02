const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("cc_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("cc_token", token);
  else localStorage.removeItem("cc_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error(data.error ?? `Request failed (${res.status})`) as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return data as T;
}

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  role: "user" | "coordinator" | "admin";
  firstName: string;
  lastName: string;
  storeName: string | null;
  localLeagueCity?: string | null;
  avatarUrl?: string | null;
  equippedFrame?: string | null;
  createdAt?: string;
};

/** Public profile card — no email. */
export type SocialUser = {
  id: number;
  username: string;
  role: "user" | "coordinator" | "admin";
  firstName: string;
  lastName: string;
  storeName: string | null;
  localLeagueCity?: string | null;
  avatarUrl?: string | null;
  equippedFrame?: string | null;
  createdAt?: string;
};

export type EarnedAchievement = {
  code: string;
  frame: string;
  earnedAt: string;
};

export type UserProfile = {
  avatar: string | null;
  defaultAvatarUrl: string | null;
  hasCustomAvatar: boolean;
  cover: string | null;
  defaultCoverUrl: string | null;
  hasCustomCover: boolean;
  equippedFrame: string | null;
  achievements: EarnedAchievement[];
};

export function formatUserName(
  user: Pick<SocialUser, "firstName" | "lastName" | "username">,
): string {
  const full = [user.firstName, user.lastName].map((p) => p?.trim()).filter(Boolean).join(" ");
  return full || user.username;
}

export type Standing = {
  points: number;
  wins: number;
  losses: number;
  draws: number;
  eventsPlayed: number;
  rank?: number | null;
  playerName?: string | null;
};

export type CreateEventInput = {
  title: string;
  description?: string;
  storeName: string;
  location?: string;
  city?: string;
  eventType: "casual" | "local_league" | "lv1" | "lv2";
  startsAt?: string;
  startsAtDates?: string[];
  registrationDeadline?: string;
  maxPlayers?: number;
  format?: string;
  allowGuestRegistration?: boolean;
  tournamentStructure?: "swiss" | "swiss_top_cut" | "single_elim";
  opsMode?: "native" | "companion_linked";
  swissRounds?: number | null;
  topCutSize?: 2 | 4 | 8 | null;
  allowLateEnrollment?: boolean;
  awardLateByes?: boolean;
  decklistRequired?: boolean;
  decklistDeadline?: string | null;
  companionEventCode?: string | null;
};

export type UpdateEventInput = {
  title?: string;
  description?: string;
  storeName?: string;
  location?: string;
  city?: string;
  startsAt?: string;
  registrationDeadline?: string | null;
  maxPlayers?: number;
  format?: string;
  allowGuestRegistration?: boolean;
  tournamentStructure?: "swiss" | "swiss_top_cut" | "single_elim";
  opsMode?: "native" | "companion_linked";
  swissRounds?: number | null;
  topCutSize?: 2 | 4 | 8 | null;
  allowLateEnrollment?: boolean;
  awardLateByes?: boolean;
  decklistRequired?: boolean;
  decklistDeadline?: string | null;
  companionEventCode?: string | null;
};

export const api = {
  register: (body: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    turnstileToken?: string;
    privacyAccepted: true;
  }) =>
    request<{ message: string; devVerifyUrl?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (login: string, password: string, turnstileToken?: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ login, password, turnstileToken }),
    }),

  me: () => request<{ user: AuthUser; standing: Standing | null }>("/auth/me"),

  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  resendVerification: (login: string, turnstileToken?: string) =>
    request<{ message: string; devVerifyUrl?: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ login, turnstileToken }),
    }),

  forgotPassword: (login: string, turnstileToken?: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ login, turnstileToken }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  getEvents: () => request<{ events: EventItem[] }>("/events"),

  lookupEventByCode: (code: string) =>
    request<{ event: Pick<EventItem, "id" | "title" | "storeName" | "location" | "city" | "startsAt" | "status" | "format" | "joinCode" | "organizerName"> }>(
      `/events/join/${encodeURIComponent(code)}`,
    ),

  getEvent: (id: number) => request<EventRegistrationResponse>(`/events/${id}/register`),

  registerEvent: (id: number, body?: { moxfieldUrl?: string; deckName?: string }) =>
    request<{ registration: Registration; message?: string; companionEventCode?: string | null }>(
      `/events/${id}/register`,
      {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      },
    ),

  registerGuestEvent: (
    id: number,
    body: {
      firstName: string;
      lastName: string;
      moxfieldUrl?: string;
      deckName?: string;
      decklistPaste?: string;
      turnstileToken?: string;
      privacyAccepted: true;
    },
  ) =>
    request<{ registration: Registration; message?: string; companionEventCode?: string | null }>(
      `/events/${id}/register/guest`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  claimEventRegistration: (id: number) =>
    request<{ registration: Registration; message?: string; companionEventCode?: string | null }>(
      `/events/${id}/register/claim`,
      {
        method: "POST",
      },
    ),

  updateDecklist: (
    id: number,
    body?: { moxfieldUrl?: string; deckName?: string; decklistPaste?: string; unlockDecklist?: boolean },
  ) =>
    request<{ registration: Registration }>(`/events/${id}/register`, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    }),

  leaveEvent: (id: number) =>
    request<{ message: string }>(`/events/${id}/register`, {
      method: "DELETE",
    }),

  getPairings: (id: number, round?: number) =>
    request<PairingsResponse>(`/events/${id}/pairings${round ? `?round=${round}` : ""}`),

  startEvent: (id: number) =>
    request<{ message: string; round: number; tables: number }>(`/events/${id}/pairings?action=start`, {
      method: "POST",
    }),

  generatePairings: (id: number, round: number, reroll = false) =>
    request<{ message: string; tables: number }>(
      `/events/${id}/pairings?action=${reroll ? "reroll" : "generate"}&round=${round}`,
      { method: "POST" },
    ),

  endRound: (id: number) =>
    request<{ message: string; round?: number; completed?: boolean; topCut?: boolean }>(
      `/events/${id}/pairings?action=end-round`,
      { method: "POST" },
    ),

  resumeSwiss: (id: number) =>
    request<{ message: string; round?: number; tables?: number; totalRounds?: number; resumedSwiss?: boolean }>(
      `/events/${id}/pairings?action=resume-swiss`,
      { method: "POST" },
    ),

  completeEvent: (id: number) =>
    request<{ message: string }>(`/events/${id}/pairings?action=complete`, { method: "POST" }),

  updateMatch: (
    id: number,
    matchId: number,
    data: { result?: string; p1Games?: number; p2Games?: number; expectedUpdatedAt?: string },
  ) =>
    request<{ match: unknown }>(`/events/${id}/pairings`, {
      method: "PATCH",
      body: JSON.stringify({ matchId, ...data }),
    }),

  dropPlayer: (id: number, registrationId: number) =>
    request<{ message: string }>(`/events/${id}/pairings?action=drop`, {
      method: "POST",
      body: JSON.stringify({ registrationId }),
    }),

  saveManualPairings: (
    id: number,
    round: number,
    pairings: { player1Id: number; player2Id: number | null; tableNumber?: number }[],
  ) =>
    request<{ message: string; warnings: string[]; round: number; tables: number }>(
      `/events/${id}/pairings?action=save-pairings`,
      { method: "POST", body: JSON.stringify({ round, pairings }) },
    ),

  setRoundTimer: (id: number, body: { round?: number; remainingSec: number; running: boolean }) =>
    request<{ message: string; timer: RoundTimer | null; round: number }>(
      `/events/${id}/pairings?action=timer`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  getEventStaff: (id: number) =>
    request<{ staff: EventStaffMember[] }>(`/events/${id}/staff`),

  addEventStaff: (id: number, login: string, role: EventStaffRole) =>
    request<{ staff: EventStaffMember }>(`/events/${id}/staff`, {
      method: "POST",
      body: JSON.stringify({ login, role }),
    }),

  removeEventStaff: (id: number, userId: number) =>
    request<{ message: string }>(`/events/${id}/staff`, {
      method: "PATCH",
      body: JSON.stringify({ userId, remove: true }),
    }),

  pullCompanionResults: (
    id: number,
    body?: {
      code?: string;
      wizardsEmail?: string;
      wizardsPassword?: string;
      markCompleted?: boolean;
    },
  ) =>
    request<CompanionPullResponse>(`/events/${id}/companion/pull`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  getCompanionResults: (id: number) =>
    request<CompanionResultsResponse>(`/events/${id}/companion`),

  remapCompanionResults: (
    id: number,
    links: { standingId: number; registrationId: number | null }[],
  ) =>
    request<CompanionRemapResponse>(`/events/${id}/companion?action=remap`, {
      method: "POST",
      body: JSON.stringify({ links }),
    }),

  updateCompanionMoxfield: (
    id: number,
    body: { registrationId: number; moxfieldUrl?: string | null; deckName?: string | null },
  ) =>
    request<{ registration: { id: number; moxfieldUrl: string | null; deckName: string | null } }>(
      `/events/${id}/companion?action=update-moxfield`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  exportDecklists: async (id: number, format: "json" | "csv" = "json") => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/events/${id}/decklists?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Export failed (${res.status})`);
    }
    if (format === "csv") return res.blob();
    return res.json();
  },

  requestMagicLink: (login: string) =>
    request<{ message: string; devMagicUrl?: string }>("/auth/magic-link", {
      method: "POST",
      body: JSON.stringify({ login }),
    }),

  consumeMagicLink: (token: string) =>
    request<{ token: string; user: AuthUser }>("/auth/magic-link/consume", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  oauthStartUrl: (provider: "google" | "discord", returnTo?: string) => {
    const params = new URLSearchParams({ provider });
    if (returnTo) params.set("return", returnTo);
    return `${API_BASE}/auth/oauth/start?${params.toString()}`;
  },

  getOrganizerProfile: (id: number) =>
    request<{
      organizer: { id: number; username: string; displayName: string; storeName: string | null; localLeagueCity: string | null };
      events: EventItem[];
    }>(`/organizers/${id}`),

  getEventDisplay: (id: number, round?: number) =>
    request<DisplayResponse>(
      `/events/${id}/display${round ? `?round=${round}` : ""}`,
    ),

  createEvent: (body: CreateEventInput) =>
    request<{ event: EventItem; events?: EventItem[]; pendingApproval?: boolean }>("/events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateEvent: (id: number, body: UpdateEventInput) =>
    request<{ event: EventItem }>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  cancelEvent: (id: number) =>
    request<{ event: EventItem; message: string }>(`/events/${id}`, {
      method: "DELETE",
    }),

  updatePreferences: (body: {
    localLeagueCity?: string;
    firstName?: string;
    lastName?: string;
  }) =>
    request<{ user: AuthUser }>("/auth/preferences", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  getProfile: () => request<{ user: AuthUser; profile: UserProfile }>("/auth/profile"),

  getPublicProfile: (id: number) =>
    request<{ user: SocialUser; profile: UserProfile; standing: Standing | null }>(`/users/${id}`),

  updateProfile: (body: {
    avatar?: string | null;
    cover?: string | null;
    equippedFrame?: string | null;
  }) =>
    request<{ user: AuthUser; profile: UserProfile }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  exportMyData: async () => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/auth/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Export failed (${res.status})`);
    }
    return res.blob();
  },

  deleteAccount: (password: string) =>
    request<{ message: string }>("/auth/delete-account", {
      method: "POST",
      body: JSON.stringify({ password, confirm: true }),
    }),

  getNews: () => request<{ posts: NewsPost[] }>("/news"),

  getLeaderboard: () =>
    request<LeaderboardResponse>("/leaderboard"),

  getMetagame: (season = "2026") =>
    request<{ decks: MetagameDeck[]; season: string }>(`/metagame?season=${season}`),

  getRules: () =>
    request<{ rules: RulesContent; banlist: RulesContent }>("/rules"),

  syncRules: () => request<{ message: string; results: Record<string, string> }>("/rules?action=sync", { method: "POST" }),

  applyCoordinator: (message: string, contactInfo: string) =>
    request<{ request: unknown }>("/coordinator/apply", {
      method: "POST",
      body: JSON.stringify({ message, contactInfo }),
    }),

  getCoordinatorRequests: () =>
    request<{ requests: CoordinatorRequest[] }>("/admin/coordinator-requests"),

  reviewCoordinator: (requestId: number, action: "approve" | "reject", storeName?: string) =>
    request<{ message: string }>("/admin/review-coordinator", {
      method: "POST",
      body: JSON.stringify({ requestId, action, storeName }),
    }),

  getEventRequests: () =>
    request<{ requests: EventItem[] }>("/admin/event-requests"),

  reviewEvent: (eventId: number, action: "approve" | "reject") =>
    request<{ message: string }>("/admin/review-event", {
      method: "POST",
      body: JSON.stringify({ eventId, action }),
    }),

  createNews: (body: { title: string; excerpt?: string; content: string }) =>
    request<{ post: NewsPost }>("/news", { method: "POST", body: JSON.stringify(body) }),
};

export type EventItem = {
  id: number;
  title: string;
  description: string | null;
  storeName: string;
  location: string | null;
  city?: string | null;
  eventType?: "casual" | "local_league" | "lv1" | "lv2";
  approvalStatus?: "approved" | "pending_review" | "rejected";
  startsAt: string;
  registrationDeadline: string | null;
  maxPlayers: number | null;
  format: string | null;
  status: string;
  organizerName?: string | null;
  organizerId?: number;
  registrationCount?: number;
  isRegistered?: boolean;
  currentRound?: number | null;
  allowGuestRegistration?: boolean;
  joinCode?: string;
  tournamentStructure?: "swiss" | "swiss_top_cut" | "single_elim";
  opsMode?: "native" | "companion_linked";
  swissRounds?: number | null;
  topCutSize?: number | null;
  allowLateEnrollment?: boolean;
  awardLateByes?: boolean;
  decklistRequired?: boolean;
  decklistDeadline?: string | null;
  companionEventCode?: string | null;
  hasCompanionEventCode?: boolean;
  companionPullStatus?: string | null;
  companionLastPulledAt?: string | null;
};

export type CompanionStandingRow = {
  id: number;
  rank: number;
  registrationId: number | null;
  companionTeamId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  matchedEmail: string | null;
  matched: boolean;
  wins: number;
  losses: number;
  draws: number;
  matchPoints: number;
  gameWinPercent: number | null;
  opponentMatchWinPercent: number | null;
  moxfieldUrl: string | null;
  deckName: string | null;
  registrationName: string | null;
};

export type CompanionRegistrationOption = {
  id: number;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string | null;
  moxfieldUrl: string | null;
  deckName: string | null;
  registrationStatus: string;
  companionTeamId: string | null;
  isGuest: boolean;
};

export type CompanionResultsResponse = {
  opsMode: "native" | "companion_linked";
  companionEventCode: string | null;
  companionLastPulledAt: string | null;
  companionPullStatus: string | null;
  isOrganizer: boolean;
  standings: CompanionStandingRow[];
  registrations: CompanionRegistrationOption[];
};

export type CompanionPullResponse = {
  message: string;
  players: number;
  matches: number;
  companionEventId: string;
  matchedCount: number;
  unmatchedCount: number;
  standings: CompanionStandingRow[];
  registrations: CompanionRegistrationOption[];
  companionLastPulledAt: string;
};

export type CompanionRemapResponse = {
  standings: CompanionStandingRow[];
  registrations: CompanionRegistrationOption[];
  matchedCount: number;
  unmatchedCount: number;
};

export type EventStaffRole = "co_organizer" | "judge" | "scorekeeper";

export type EventStaffMember = {
  id: number;
  userId: number;
  role: EventStaffRole;
  username: string;
  displayName: string;
  email?: string;
};

export type EventPermissions = {
  canManage: boolean;
  canEditPairings: boolean;
  canScore: boolean;
  canDrop: boolean;
  canViewDecklists: boolean;
  canDeleteEvent: boolean;
  canManageStaff: boolean;
  staffRole: EventStaffRole | null;
};

export type RegistrationSummary = {
  confirmedTotal: number;
  confirmedMembers: number;
  confirmedGuests: number;
  waitlisted: number;
  maxPlayers: number | null;
};

export type Registration = {
  id: number;
  eventId: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  displayName: string;
  moxfieldUrl: string | null;
  deckName: string | null;
  decklistSource?: string | null;
  decklistLockedAt?: string | null;
  hasDecklist?: boolean;
  decklistJson?: {
    main: { name: string; qty: number }[];
    commanders: { name: string; qty: number }[];
  } | null;
  registrationStatus: "confirmed" | "waitlisted" | "dropped";
  isGuest: boolean;
  registeredAt?: string;
};

export type EventRegistrationResponse = {
  event: EventItem;
  registrations: Registration[];
  summary: RegistrationSummary;
  claimableGuestRegistration: Registration | null;
  permissions?: EventPermissions | null;
};

export type MatchItem = {
  id: number;
  round: number;
  phaseId?: number | null;
  result: string;
  p1Games: number | null;
  p2Games: number | null;
  tableNumber: number | null;
  player1: string;
  player2: string;
  player1Id: number;
  player2Id: number | null;
  reportedBy?: number | null;
  reportedByName?: string | null;
  updatedAt?: string;
};

export type RoundTimer = {
  remainingSec: number;
  running: boolean;
};

export type PairingMeta = { rerollCount: number; round: number };

export type TournamentStanding = {
  rank: number;
  userId: number;
  displayName: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  byes: number;
  omw: number;
};

export type EventPhase = {
  id: number;
  eventId: number;
  phaseIndex: number;
  kind: "swiss" | "top_cut";
  status: "pending" | "active" | "completed";
  roundCount: number | null;
  cutSize: number | null;
  currentRound: number;
};

export type PairingsResponse = {
  matches: MatchItem[];
  meta: PairingMeta | null;
  timer: RoundTimer | null;
  event: EventItem;
  standings: TournamentStanding[];
  totalRounds: number;
  availableRounds: number[];
  playerCount: number;
  isOrganizer: boolean;
  permissions?: EventPermissions;
  phases?: EventPhase[];
  activePhase?: EventPhase | null;
  phaseKind?: "swiss" | "top_cut";
};

export type DisplayMatch = {
  id: number;
  tableNumber: number | null;
  result: string;
  p1Games: number | null;
  p2Games: number | null;
  player1: string;
  player2: string;
};

export type DisplayStanding = {
  rank: number;
  displayName: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
};

export type DisplayResponse = {
  event: Pick<EventItem, "id" | "title" | "storeName" | "status" | "currentRound" | "format">;
  round: number;
  matches: DisplayMatch[];
  standings: DisplayStanding[];
  timer: RoundTimer | null;
  totalRounds: number;
  availableRounds: number[];
  updatedAt: string;
};

export type NewsPost = {
  id: number;
  title: string;
  excerpt: string | null;
  content: string;
  createdAt: string;
  authorName: string | null;
};

export type LeaderboardEventColumn = {
  key: string;
  label: string;
};

export type LeaderboardAchievement = {
  code: string;
  frame: string;
};

export type LeaderboardPlayer = {
  rank: number;
  playerName: string;
  total: number;
  top4Livello2: string | number | null;
  leaguesS1: string | number | null;
  leaguesS2: string | number | null;
  events: { key: string; label: string; value: string | number | null }[];
  /** Matched to a Cent Companion account */
  claimed?: boolean;
  userId?: number | null;
  username?: string | null;
  avatarUrl?: string | null;
  equippedFrame?: string | null;
  achievements?: LeaderboardAchievement[];
};

export type LeaderboardResponse = {
  season: string;
  title: string;
  sourceUrl: string;
  syncedAt: string;
  eventColumns: LeaderboardEventColumn[];
  leaderboard: LeaderboardPlayer[];
  myStanding: { rank: number; points: number; playerName: string } | null;
};

/** @deprecated use LeaderboardPlayer */
export type LeaderboardRow = {
  rank: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  eventsPlayed: number;
  username: string;
  displayName: string | null;
};

export type MetagameDeck = {
  id: number;
  name: string;
  archetype: string;
  metaShare: number;
  winRate: number;
  tier: string | null;
};

export type RulesContent = {
  type: string;
  contentHtml: string;
  syncedAt: string | null;
};

export type CoordinatorRequest = {
  id: number;
  message: string;
  contactInfo: string;
  status: string;
  createdAt: string;
  username: string;
  email: string;
  displayName: string | null;
};
