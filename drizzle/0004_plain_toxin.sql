CREATE TABLE "match_room_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"tournament_id" integer NOT NULL,
	"group_id" integer,
	"group_name" varchar(10),
	"sent_by" integer,
	"sent_by_name" varchar(100),
	"room_id" varchar(100),
	"room_password" varchar(100),
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_group_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"tournament_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"name" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"group_id" integer,
	"name" varchar(200),
	"room_id" varchar(100),
	"room_password" varchar(100),
	"match_start_time" timestamp,
	"room_reveal_at" timestamp,
	"status" varchar(30) DEFAULT 'upcoming' NOT NULL,
	"room_notified_at" timestamp,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_room_logs" ADD CONSTRAINT "match_room_logs_match_id_tournament_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_room_logs" ADD CONSTRAINT "match_room_logs_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_room_logs" ADD CONSTRAINT "match_room_logs_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_room_logs" ADD CONSTRAINT "match_room_logs_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_group_teams" ADD CONSTRAINT "tournament_group_teams_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_group_teams" ADD CONSTRAINT "tournament_group_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_group_teams" ADD CONSTRAINT "tournament_group_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_groups" ADD CONSTRAINT "tournament_groups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_room_log_match_idx" ON "match_room_logs" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_room_log_tourn_idx" ON "match_room_logs" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "t_group_team_unique" ON "tournament_group_teams" USING btree ("tournament_id","team_id");--> statement-breakpoint
CREATE INDEX "t_group_teams_group_idx" ON "tournament_group_teams" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "t_group_tournament_idx" ON "tournament_groups" USING btree ("tournament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "t_group_unique" ON "tournament_groups" USING btree ("tournament_id","name");--> statement-breakpoint
CREATE INDEX "t_match_tournament_idx" ON "tournament_matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "t_match_group_idx" ON "tournament_matches" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "t_match_reveal_idx" ON "tournament_matches" USING btree ("room_reveal_at","status");