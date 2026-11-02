CREATE TYPE "event_staff_role" AS ENUM ('co_organizer', 'judge', 'scorekeeper');--> statement-breakpoint
CREATE TABLE "event_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "event_staff_role" DEFAULT 'scorekeeper' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_staff_user_idx" ON "event_staff" USING btree ("event_id","user_id");
