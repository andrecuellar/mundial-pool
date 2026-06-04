CREATE TABLE "client_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"url" text,
	"user_agent" text,
	"fingerprint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_errors" ADD CONSTRAINT "client_errors_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_errors_created" ON "client_errors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_client_errors_fingerprint_created" ON "client_errors" USING btree ("fingerprint","created_at");