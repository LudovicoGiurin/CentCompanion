ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "companion_team_id" varchar(64);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companion_standings" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"registration_id" integer,
	"companion_team_id" varchar(64),
	"first_name" varchar(128) NOT NULL,
	"last_name" varchar(128) NOT NULL DEFAULT '',
	"display_name" varchar(255),
	"matched_email" varchar(255),
	"wins" integer NOT NULL DEFAULT 0,
	"losses" integer NOT NULL DEFAULT 0,
	"draws" integer NOT NULL DEFAULT 0,
	"match_points" integer NOT NULL DEFAULT 0,
	"game_win_percent" integer,
	"opponent_match_win_percent" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companion_standings" ADD CONSTRAINT "companion_standings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companion_standings" ADD CONSTRAINT "companion_standings_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companion_standings_event_idx" ON "companion_standings" ("event_id");
