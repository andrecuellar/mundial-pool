ALTER TABLE "players" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_external_id_unique" UNIQUE("external_id");