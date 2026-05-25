ALTER TABLE "categories" ADD COLUMN "default_points" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "player_text" text;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "player_text" text;