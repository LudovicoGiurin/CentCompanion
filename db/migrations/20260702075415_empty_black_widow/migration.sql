CREATE TYPE "event_approval_status" AS ENUM('approved', 'pending_review', 'rejected');--> statement-breakpoint
CREATE TYPE "event_type" AS ENUM('casual', 'local_league', 'lv1', 'lv2');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "city" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type" "event_type" DEFAULT 'casual'::"event_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "approval_status" "event_approval_status" DEFAULT 'approved'::"event_approval_status" NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "approved_by" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "local_league_city" varchar(128);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_approved_by_users_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id");