CREATE TABLE "group_creation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "can_create_groups" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "group_creation_requests" ADD CONSTRAINT "group_creation_requests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_creation_requests" ADD CONSTRAINT "group_creation_requests_reviewed_by_user_id_profiles_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gcr_status" ON "group_creation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_gcr_user" ON "group_creation_requests" USING btree ("user_id");--> statement-breakpoint
-- Only one pending request per user at a time. Approved/rejected rows are
-- kept as history and don't block re-requests.
CREATE UNIQUE INDEX "uniq_gcr_pending_per_user" ON "group_creation_requests" ("user_id") WHERE "status" = 'pending';--> statement-breakpoint
-- Grandfather: any user who already created at least one group gets the
-- capability auto. Preserves the flow for existing creators.
UPDATE "profiles" SET "can_create_groups" = true
WHERE "id" IN (SELECT DISTINCT "created_by" FROM "groups");