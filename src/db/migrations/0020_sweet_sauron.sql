CREATE TABLE "admin_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sent_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"audience_filter" jsonb NOT NULL,
	"audience_count" integer NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"ignore_opt_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_broadcasts" ADD CONSTRAINT "admin_broadcasts_sent_by_user_id_profiles_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_broadcasts_created" ON "admin_broadcasts" USING btree ("created_at");