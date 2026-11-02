import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "coordinator", "admin"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected"]);
export const eventStatusEnum = pgEnum("event_status", ["upcoming", "ongoing", "completed", "cancelled"]);
export const eventTypeEnum = pgEnum("event_type", ["casual", "local_league", "lv1", "lv2"]);
export const eventApprovalStatusEnum = pgEnum("event_approval_status", ["approved", "pending_review", "rejected"]);
export const matchResultEnum = pgEnum("match_result", ["pending", "p1_win", "p2_win", "draw"]);
export const contentTypeEnum = pgEnum("content_type", ["rules", "banlist"]);
export const registrationStatusEnum = pgEnum("registration_status", ["confirmed", "waitlisted", "dropped"]);
export const tournamentStructureEnum = pgEnum("tournament_structure", ["swiss", "swiss_top_cut", "single_elim"]);
export const opsModeEnum = pgEnum("ops_mode", ["native", "companion_linked"]);
export const phaseKindEnum = pgEnum("phase_kind", ["swiss", "top_cut"]);
export const phaseStatusEnum = pgEnum("phase_status", ["pending", "active", "completed"]);
export const eventStaffRoleEnum = pgEnum("event_staff_role", ["co_organizer", "judge", "scorekeeper"]);
export const decklistSourceEnum = pgEnum("decklist_source", ["moxfield", "manual", "paste"]);
export const oauthProviderEnum = pgEnum("oauth_provider", ["google", "discord"]);

export const users = pgTable(
  "users",
  {
    id: serial().primaryKey(),
    email: varchar({ length: 255 }).notNull(),
    username: varchar({ length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum().notNull().default("user"),
    emailVerified: boolean("email_verified").notNull().default(false),
    storeName: varchar("store_name", { length: 255 }),
    firstName: varchar("first_name", { length: 64 }).notNull().default(""),
    lastName: varchar("last_name", { length: 64 }).notNull().default(""),
    displayName: varchar("display_name", { length: 128 }),
    localLeagueCity: varchar("local_league_city", { length: 128 }),
    avatarUrl: text("avatar_url"),
    avatarCustom: text("avatar_custom"),
    coverCustom: text("cover_custom"),
    equippedFrame: varchar("equipped_frame", { length: 32 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_username_idx").on(t.username),
  ],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: serial().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: varchar({ length: 64 }).notNull(),
    earnedAt: timestamp("earned_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("user_achievement_idx").on(t.userId, t.code)],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: serial().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum().notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    providerEmail: varchar("provider_email", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("oauth_provider_user_idx").on(t.provider, t.providerUserId)],
);

export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: serial().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar({ length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar({ length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar({ length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coordinatorRequests = pgTable("coordinator_requests", {
  id: serial().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text().notNull(),
  contactInfo: text("contact_info").notNull(),
  status: requestStatusEnum().notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const newsPosts = pgTable("news_posts", {
  id: serial().primaryKey(),
  title: varchar({ length: 255 }).notNull(),
  excerpt: text(),
  content: text().notNull(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  published: boolean().notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const events = pgTable(
  "events",
  {
    id: serial().primaryKey(),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
    storeName: varchar("store_name", { length: 255 }).notNull(),
    location: varchar({ length: 255 }),
    city: varchar({ length: 128 }),
    organizerId: integer("organizer_id")
      .notNull()
      .references(() => users.id),
    eventType: eventTypeEnum("event_type").notNull().default("casual"),
    approvalStatus: eventApprovalStatusEnum("approval_status").notNull().default("approved"),
    approvedBy: integer("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at"),
    startsAt: timestamp("starts_at").notNull(),
    registrationDeadline: timestamp("registration_deadline"),
    maxPlayers: integer("max_players").default(32),
    allowGuestRegistration: boolean("allow_guest_registration").notNull().default(true),
    format: varchar({ length: 64 }).default("Swiss"),
    tournamentStructure: tournamentStructureEnum("tournament_structure").notNull().default("swiss"),
    opsMode: opsModeEnum("ops_mode").notNull().default("native"),
    swissRounds: integer("swiss_rounds"),
    topCutSize: integer("top_cut_size"),
    allowLateEnrollment: boolean("allow_late_enrollment").notNull().default(false),
    awardLateByes: boolean("award_late_byes").notNull().default(false),
    decklistRequired: boolean("decklist_required").notNull().default(false),
    decklistDeadline: timestamp("decklist_deadline"),
    companionEventCode: varchar("companion_event_code", { length: 16 }),
    companionEventId: varchar("companion_event_id", { length: 64 }),
    companionLastPulledAt: timestamp("companion_last_pulled_at"),
    companionPullStatus: text("companion_pull_status"),
    status: eventStatusEnum().notNull().default("upcoming"),
    currentRound: integer("current_round").default(0),
    currentPhaseId: integer("current_phase_id"),
    joinCode: varchar("join_code", { length: 6 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("events_join_code_idx").on(t.joinCode)],
);

export const eventPhases = pgTable(
  "event_phases",
  {
    id: serial().primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    phaseIndex: integer("phase_index").notNull().default(0),
    kind: phaseKindEnum().notNull().default("swiss"),
    status: phaseStatusEnum().notNull().default("pending"),
    roundCount: integer("round_count"),
    cutSize: integer("cut_size"),
    currentRound: integer("current_round").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_phase_index_idx").on(t.eventId, t.phaseIndex)],
);

export const eventStaff = pgTable(
  "event_staff",
  {
    id: serial().primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: eventStaffRoleEnum().notNull().default("scorekeeper"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_staff_user_idx").on(t.eventId, t.userId)],
);

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: serial().primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 64 }).notNull(),
    lastName: varchar("last_name", { length: 64 }).notNull(),
    moxfieldUrl: text("moxfield_url"),
    deckName: varchar("deck_name", { length: 255 }),
    decklistJson: jsonb("decklist_json").$type<{
      main: { name: string; qty: number }[];
      commanders: { name: string; qty: number }[];
      hash?: string;
    } | null>(),
    decklistLockedAt: timestamp("decklist_locked_at"),
    decklistSource: decklistSourceEnum("decklist_source"),
    registrationStatus: registrationStatusEnum("registration_status").notNull().default("confirmed"),
    isGuest: boolean("is_guest").notNull().default(false),
    companionTeamId: varchar("companion_team_id", { length: 64 }),
    registeredAt: timestamp("registered_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("event_user_idx").on(t.eventId, t.userId)],
);

export const companionStandings = pgTable("companion_standings", {
  id: serial().primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  rank: integer().notNull(),
  registrationId: integer("registration_id").references(() => eventRegistrations.id, {
    onDelete: "set null",
  }),
  companionTeamId: varchar("companion_team_id", { length: 64 }),
  firstName: varchar("first_name", { length: 128 }).notNull(),
  lastName: varchar("last_name", { length: 128 }).notNull().default(""),
  displayName: varchar("display_name", { length: 255 }),
  matchedEmail: varchar("matched_email", { length: 255 }),
  wins: integer().notNull().default(0),
  losses: integer().notNull().default(0),
  draws: integer().notNull().default(0),
  matchPoints: integer("match_points").notNull().default(0),
  gameWinPercent: integer("game_win_percent"),
  opponentMatchWinPercent: integer("opponent_match_win_percent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matches = pgTable("matches", {
  id: serial().primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  phaseId: integer("phase_id").references(() => eventPhases.id, { onDelete: "set null" }),
  round: integer().notNull(),
  player1Id: integer("player1_id")
    .notNull()
    .references(() => users.id),
  player2Id: integer("player2_id").references(() => users.id),
  result: matchResultEnum().notNull().default("pending"),
  p1Games: integer("p1_games"),
  p2Games: integer("p2_games"),
  tableNumber: integer("table_number"),
  reportedBy: integer("reported_by").references(() => users.id),
  reportedAt: timestamp("reported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pairingMeta = pgTable(
  "pairing_meta",
  {
    id: serial().primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    phaseId: integer("phase_id").references(() => eventPhases.id, { onDelete: "set null" }),
    round: integer().notNull(),
    rerollCount: integer("reroll_count").notNull().default(0),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    roundTimerSec: integer("round_timer_sec"),
    roundTimerRunning: boolean("round_timer_running").notNull().default(false),
    roundTimerAt: timestamp("round_timer_at"),
  },
  (t) => [uniqueIndex("event_phase_round_idx").on(t.eventId, t.phaseId, t.round)],
);

export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    id: serial().primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    season: varchar({ length: 32 }).notNull().default("2026"),
    points: integer().notNull().default(0),
    wins: integer().notNull().default(0),
    losses: integer().notNull().default(0),
    draws: integer().notNull().default(0),
    eventsPlayed: integer("events_played").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("user_season_idx").on(t.userId, t.season)],
);

export const rulesContent = pgTable("rules_content", {
  id: serial().primaryKey(),
  type: contentTypeEnum().notNull(),
  contentHtml: text("content_html").notNull(),
  sourceHash: varchar("source_hash", { length: 64 }),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const metagameDecks = pgTable("metagame_decks", {
  id: serial().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  archetype: varchar({ length: 128 }).notNull(),
  metaShare: integer("meta_share").notNull().default(0),
  winRate: integer("win_rate").notNull().default(50),
  tier: varchar({ length: 8 }).default("B"),
  season: varchar({ length: 32 }).notNull().default("2026"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventPhase = typeof eventPhases.$inferSelect;
export type EventStaff = typeof eventStaff.$inferSelect;
export type NewsPost = typeof newsPosts.$inferSelect;
