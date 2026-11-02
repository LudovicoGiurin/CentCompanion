ALTER TABLE "pairing_meta" ADD COLUMN "round_timer_sec" integer;--> statement-breakpoint
ALTER TABLE "pairing_meta" ADD COLUMN "round_timer_running" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pairing_meta" ADD COLUMN "round_timer_at" timestamp;
