ALTER TABLE "teams" DROP CONSTRAINT "teams_fifa_code_unique";--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "fifa_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "external_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "badge_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_external_id_unique" UNIQUE("external_id");