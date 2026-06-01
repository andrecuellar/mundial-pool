ALTER TABLE "profiles" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banned_reason" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banned_by_user_id" uuid;