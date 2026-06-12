ALTER TABLE "players" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "goals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "assists" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "minutes_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "last_synced_at" timestamp with time zone;