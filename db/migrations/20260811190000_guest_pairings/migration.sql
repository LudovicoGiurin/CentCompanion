ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "event_registrations" SET "is_guest" = true WHERE "user_id" IS NULL;
