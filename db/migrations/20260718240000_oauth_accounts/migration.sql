CREATE TYPE "oauth_provider" AS ENUM ('google', 'discord');--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"provider_email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_user_idx" ON "oauth_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_unique" UNIQUE("token")
);--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
