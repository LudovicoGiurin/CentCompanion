CREATE TYPE "content_type" AS ENUM('rules', 'banlist');--> statement-breakpoint
CREATE TYPE "event_status" AS ENUM('upcoming', 'ongoing', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "match_result" AS ENUM('pending', 'p1_win', 'p2_win', 'draw');--> statement-breakpoint
CREATE TYPE "request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('user', 'coordinator', 'admin');--> statement-breakpoint
CREATE TABLE "coordinator_requests" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"contact_info" text NOT NULL,
	"status" "request_status" DEFAULT 'pending'::"request_status" NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"token" varchar(128) NOT NULL UNIQUE,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" serial PRIMARY KEY,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"moxfield_url" text NOT NULL,
	"deck_name" varchar(255),
	"registered_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY,
	"title" varchar(255) NOT NULL,
	"description" text,
	"store_name" varchar(255) NOT NULL,
	"location" varchar(255),
	"organizer_id" integer NOT NULL,
	"starts_at" timestamp NOT NULL,
	"registration_deadline" timestamp,
	"max_players" integer DEFAULT 32,
	"format" varchar(64) DEFAULT 'Swiss',
	"status" "event_status" DEFAULT 'upcoming'::"event_status" NOT NULL,
	"current_round" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"season" varchar(32) DEFAULT '2026' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"events_played" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY,
	"event_id" integer NOT NULL,
	"round" integer NOT NULL,
	"player1_id" integer NOT NULL,
	"player2_id" integer,
	"result" "match_result" DEFAULT 'pending'::"match_result" NOT NULL,
	"table_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metagame_decks" (
	"id" serial PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"archetype" varchar(128) NOT NULL,
	"meta_share" integer DEFAULT 0 NOT NULL,
	"win_rate" integer DEFAULT 50 NOT NULL,
	"tier" varchar(8) DEFAULT 'B',
	"season" varchar(32) DEFAULT '2026' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_posts" (
	"id" serial PRIMARY KEY,
	"title" varchar(255) NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"author_id" integer NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairing_meta" (
	"id" serial PRIMARY KEY,
	"event_id" integer NOT NULL,
	"round" integer NOT NULL,
	"reroll_count" integer DEFAULT 0 NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"token" varchar(128) NOT NULL UNIQUE,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules_content" (
	"id" serial PRIMARY KEY,
	"type" "content_type" NOT NULL,
	"content_html" text NOT NULL,
	"source_hash" varchar(64),
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(255) NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user'::"user_role" NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"store_name" varchar(255),
	"display_name" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "event_user_idx" ON "event_registrations" ("event_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_season_idx" ON "leaderboard_entries" ("user_id","season");--> statement-breakpoint
CREATE UNIQUE INDEX "event_round_idx" ON "pairing_meta" ("event_id","round");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" ("username");--> statement-breakpoint
ALTER TABLE "coordinator_requests" ADD CONSTRAINT "coordinator_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "coordinator_requests" ADD CONSTRAINT "coordinator_requests_reviewed_by_users_id_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_users_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_users_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_users_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "pairing_meta" ADD CONSTRAINT "pairing_meta_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;