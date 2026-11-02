CREATE TYPE "registration_status" AS ENUM ('confirmed', 'waitlisted');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "users" SET "first_name" = COALESCE(NULLIF(trim("display_name"), ''), "username"), "last_name" = '' WHERE "first_name" = '';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allow_guest_registration" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "first_name" varchar(64);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "last_name" varchar(64);--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "registration_status" "registration_status" DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
UPDATE "event_registrations" er SET "first_name" = COALESCE(u."display_name", u."username"), "last_name" = '' FROM "users" u WHERE er."user_id" = u."id";--> statement-breakpoint
UPDATE "event_registrations" SET "first_name" = 'Player', "last_name" = '' WHERE "first_name" IS NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ALTER COLUMN "first_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ALTER COLUMN "last_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ALTER COLUMN "moxfield_url" DROP NOT NULL;
