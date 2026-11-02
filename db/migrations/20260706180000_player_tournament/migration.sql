ALTER TABLE "events" ADD COLUMN "join_code" varchar(6);--> statement-breakpoint
UPDATE "events" SET "join_code" = upper(substr(replace(md5(random()::text || id::text), '/', ''), 1, 6)) WHERE "join_code" IS NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "join_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "events_join_code_idx" ON "events" ("join_code");--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reported_by" integer REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reported_at" timestamp;
