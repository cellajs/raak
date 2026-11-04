-- Hand-added: a token whose invitation row is gone would refuse the foreign key, and it opens nothing, so it goes.
DELETE FROM "tokens" WHERE "inactive_membership_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "inactive_memberships" WHERE "inactive_memberships"."id" = "tokens"."inactive_membership_id");--> statement-breakpoint
DROP INDEX "notifications_user_activity_index";--> statement-breakpoint
ALTER TABLE "channel_counters" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "digested_at";--> statement-breakpoint
ALTER TABLE "sync_incidents" DROP COLUMN "position_to";--> statement-breakpoint
CREATE INDEX "tokens_inactive_membership_id_idx" ON "tokens" ("inactive_membership_id") WHERE "inactive_membership_id" is not null;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_inactive_membership_id_inactive_memberships_id_fkey" FOREIGN KEY ("inactive_membership_id") REFERENCES "inactive_memberships"("id") ON DELETE CASCADE;