CREATE TYPE "decklist_source" AS ENUM ('moxfield', 'manual', 'paste');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "decklist_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "decklist_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "decklist_json" jsonb;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "decklist_locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "decklist_source" "decklist_source";
