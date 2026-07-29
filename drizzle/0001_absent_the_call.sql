CREATE TYPE "public"."team_tx_type" AS ENUM('earn_tournament', 'earn_manual', 'deduct_tournament', 'deduct_manual', 'admin_award', 'admin_deduct', 'team_split', 'withdraw');--> statement-breakpoint
ALTER TYPE "public"."withdraw_method" ADD VALUE 'baridimob';--> statement-breakpoint
CREATE TABLE "app_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(30) NOT NULL,
	"apk_url" text NOT NULL,
	"apk_size" varchar(20),
	"apk_data" "bytea",
	"release_notes" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"force_update" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer,
	"type" "team_tx_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"description" text,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"locked_balance" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_transactions" ADD CONSTRAINT "team_transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_transactions" ADD CONSTRAINT "team_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_wallets" ADD CONSTRAINT "team_wallets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_tx_team_idx" ON "team_transactions" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_tx_user_idx" ON "team_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_wallets_team_idx" ON "team_wallets" USING btree ("team_id");