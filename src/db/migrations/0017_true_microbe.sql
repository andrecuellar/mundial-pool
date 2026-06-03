CREATE TYPE "public"."match_stage" AS ENUM('group', 'r32', 'r16', 'qf', 'sf', 'third_place', 'final');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"stage" "match_stage" NOT NULL,
	"group_name" text,
	"kicked_off_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"team_a_id" uuid,
	"team_b_id" uuid,
	"score_a" integer,
	"score_b" integer,
	"penalty_a" integer,
	"penalty_b" integer,
	"source" text DEFAULT 'thesportsdb' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "reached_round" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "group_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "group_goal_diff" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "group_goals_for" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "group_goals_against" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "yellow_cards" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "red_cards" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "lost_in_penalties" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "elim_match_goals_for" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "elim_match_goals_against" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "elim_match_went_to_penalties" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_matches_stage" ON "matches" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_matches_team_a" ON "matches" USING btree ("team_a_id");--> statement-breakpoint
CREATE INDEX "idx_matches_team_b" ON "matches" USING btree ("team_b_id");