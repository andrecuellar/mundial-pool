CREATE TYPE "public"."payout_rule" AS ENUM('winner_takes_all', 'top_3_split', 'manual');--> statement-breakpoint
CREATE TABLE "pool_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"contributor_user_id" uuid,
	"contributor_label" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text NOT NULL,
	"note" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "pool_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "pool_currency" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "pool_qr_url" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "pool_payout_rule" "payout_rule" DEFAULT 'winner_takes_all' NOT NULL;--> statement-breakpoint
ALTER TABLE "pool_transactions" ADD CONSTRAINT "pool_transactions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_transactions" ADD CONSTRAINT "pool_transactions_contributor_user_id_profiles_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pool_transactions" ADD CONSTRAINT "pool_transactions_created_by_user_id_profiles_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;