CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"icon" varchar(50) DEFAULT '🏆' NOT NULL,
	"condition" jsonb NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"rarity" varchar(20) DEFAULT 'common' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer,
	"type" varchar(20) DEFAULT 'message' NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"read_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(50) NOT NULL,
	"period" varchar(20) NOT NULL,
	"date" varchar(10) NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(20) NOT NULL,
	"tournament_id" integer,
	"scrim_id" integer,
	"team_id" integer NOT NULL,
	"placement" integer,
	"kills" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"prize_earned" integer DEFAULT 0 NOT NULL,
	"player_stats" jsonb,
	"played_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_matches" integer DEFAULT 0 NOT NULL,
	"total_kills" integer DEFAULT 0 NOT NULL,
	"total_deaths" integer DEFAULT 0 NOT NULL,
	"total_wins" integer DEFAULT 0 NOT NULL,
	"top3_finishes" integer DEFAULT 0 NOT NULL,
	"total_placement_sum" integer DEFAULT 0 NOT NULL,
	"total_prize_earned" integer DEFAULT 0 NOT NULL,
	"ad_watched_total" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season_rankings" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"rank" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"tournaments" integer DEFAULT 0 NOT NULL,
	"prize_earned" integer DEFAULT 0 NOT NULL,
	"reward_claimed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"rewards" jsonb,
	"stats" jsonb,
	"rankings" jsonb,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_finished" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" integer NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_scrim_id_scrims_id_fk" FOREIGN KEY ("scrim_id") REFERENCES "public"."scrims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rankings" ADD CONSTRAINT "season_rankings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rankings" ADD CONSTRAINT "season_rankings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_rankings" ADD CONSTRAINT "season_rankings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_key_idx" ON "achievements" USING btree ("key");--> statement-breakpoint
CREATE INDEX "chat_team_idx" ON "chat_messages" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "chat_created_idx" ON "chat_messages" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leaderboard_unique" ON "leaderboard_snapshots" USING btree ("category","period","date");--> statement-breakpoint
CREATE INDEX "leaderboard_cat_idx" ON "leaderboard_snapshots" USING btree ("category","period");--> statement-breakpoint
CREATE INDEX "match_history_team_idx" ON "match_history" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "match_history_type_idx" ON "match_history" USING btree ("type");--> statement-breakpoint
CREATE INDEX "match_history_date_idx" ON "match_history" USING btree ("played_at");--> statement-breakpoint
CREATE UNIQUE INDEX "player_stats_user_idx" ON "player_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "season_rankings_season_idx" ON "season_rankings" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "season_rankings_user_idx" ON "season_rankings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "season_rankings_team_idx" ON "season_rankings" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "seasons_active_idx" ON "seasons" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_unique" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_achievements_user_idx" ON "user_achievements" USING btree ("user_id");