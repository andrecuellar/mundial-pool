ALTER TABLE "groups" ADD COLUMN "pool_buy_in_amount" numeric(12, 2) DEFAULT '100.00' NOT NULL;
--> statement-breakpoint
-- Wipe test contributions: enforcing a fixed buy-in retroactively would otherwise
-- create inconsistent rows. Verified with the team — no real money in yet.
TRUNCATE TABLE "pool_transactions";