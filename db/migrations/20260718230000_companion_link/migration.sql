ALTER TABLE "events" ADD COLUMN "companion_event_code" varchar(16);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "companion_event_id" varchar(64);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "companion_last_pulled_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "companion_pull_status" text;
