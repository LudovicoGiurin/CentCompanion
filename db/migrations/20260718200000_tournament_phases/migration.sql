CREATE TYPE "tournament_structure" AS ENUM ('swiss', 'swiss_top_cut', 'single_elim');--> statement-breakpoint
CREATE TYPE "ops_mode" AS ENUM ('native', 'companion_linked');--> statement-breakpoint
CREATE TYPE "phase_kind" AS ENUM ('swiss', 'top_cut');--> statement-breakpoint
CREATE TYPE "phase_status" AS ENUM ('pending', 'active', 'completed');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tournament_structure" "tournament_structure" DEFAULT 'swiss' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ops_mode" "ops_mode" DEFAULT 'native' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "swiss_rounds" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "top_cut_size" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_late_enrollment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "award_late_byes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "current_phase_id" integer;--> statement-breakpoint
CREATE TABLE "event_phases" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"phase_index" integer DEFAULT 0 NOT NULL,
	"kind" "phase_kind" DEFAULT 'swiss' NOT NULL,
	"status" "phase_status" DEFAULT 'pending' NOT NULL,
	"round_count" integer,
	"cut_size" integer,
	"current_round" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "event_phases" ADD CONSTRAINT "event_phases_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_phase_index_idx" ON "event_phases" USING btree ("event_id","phase_index");--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "phase_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_phase_id_event_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."event_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_meta" ADD COLUMN "phase_id" integer;--> statement-breakpoint
ALTER TABLE "pairing_meta" ADD CONSTRAINT "pairing_meta_phase_id_event_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."event_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "event_round_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "event_phase_round_idx" ON "pairing_meta" USING btree ("event_id","phase_id","round");--> statement-breakpoint
INSERT INTO "event_phases" ("event_id", "phase_index", "kind", "status", "round_count", "current_round")
SELECT e.id, 0, 'swiss',
  CASE WHEN e.status = 'ongoing' THEN 'active'::phase_status
       WHEN e.status = 'completed' THEN 'completed'::phase_status
       ELSE 'pending'::phase_status END,
  e.current_round,
  COALESCE(e.current_round, 0)
FROM "events" e
WHERE NOT EXISTS (SELECT 1 FROM "event_phases" p WHERE p.event_id = e.id);--> statement-breakpoint
UPDATE "matches" m SET "phase_id" = p.id
FROM "event_phases" p
WHERE m.event_id = p.event_id AND p.phase_index = 0 AND m.phase_id IS NULL;--> statement-breakpoint
UPDATE "pairing_meta" pm SET "phase_id" = p.id
FROM "event_phases" p
WHERE pm.event_id = p.event_id AND p.phase_index = 0 AND pm.phase_id IS NULL;--> statement-breakpoint
UPDATE "events" e SET "current_phase_id" = p.id
FROM "event_phases" p
WHERE e.id = p.event_id AND p.phase_index = 0 AND e.current_phase_id IS NULL;
