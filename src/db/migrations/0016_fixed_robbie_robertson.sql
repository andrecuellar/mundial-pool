CREATE INDEX "idx_group_members_user" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pool_tx_group_user" ON "pool_transactions" USING btree ("group_id","contributor_user_id");--> statement-breakpoint
CREATE INDEX "idx_predictions_group_category" ON "predictions" USING btree ("group_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_predictions_category" ON "predictions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_results_resolved_at" ON "results" USING btree ("resolved_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_profiles_banned_at" ON "profiles" USING btree ("banned_at") WHERE "banned_at" IS NOT NULL;