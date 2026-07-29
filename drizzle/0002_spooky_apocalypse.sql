CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event" varchar(100) NOT NULL,
	"page" varchar(100),
	"meta" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"session_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" varchar(10) NOT NULL,
	"metric" varchar(100) NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fcm_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(20) DEFAULT 'android' NOT NULL,
	"device_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(255) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_event_idx" ON "analytics_events" USING btree ("event");--> statement-breakpoint
CREATE INDEX "analytics_user_idx" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analytics_date_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_analytics_unique" ON "daily_analytics" USING btree ("date","metric");--> statement-breakpoint
CREATE INDEX "daily_analytics_date_idx" ON "daily_analytics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "fcm_user_idx" ON "fcm_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fcm_token_idx" ON "fcm_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "fcm_token_unique" ON "fcm_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_key_idx" ON "rate_limits" USING btree ("key");--> statement-breakpoint
CREATE INDEX "rate_limit_window_idx" ON "rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "invitations_invited_user_idx" ON "invitations" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "invitations_team_idx" ON "invitations" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "join_requests_team_idx" ON "join_requests" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "join_requests_user_idx" ON "join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_user_read_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "recharge_user_idx" ON "recharge_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recharge_status_idx" ON "recharge_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scrim_reg_team_idx" ON "scrim_registrations" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tournament_teams_team_idx" ON "tournament_teams" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "withdraw_captain_idx" ON "withdraw_requests" USING btree ("captain_id");--> statement-breakpoint
CREATE INDEX "withdraw_status_idx" ON "withdraw_requests" USING btree ("status");