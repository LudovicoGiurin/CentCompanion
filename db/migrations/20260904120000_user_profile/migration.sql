ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_custom" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "equipped_frame" varchar(32);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code" varchar(64) NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievement_idx" ON "user_achievements" USING btree ("user_id","code");
