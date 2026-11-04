-- Stored impersonation rows go before the column that marked them: a leftover row would read as a session of the user's own.
DELETE FROM "sessions" WHERE "type" = 'impersonation';--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_impersonator_session_id_sessions_id_fkey";--> statement-breakpoint
DROP INDEX "sessions_impersonator_session_id_idx";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "impersonator_session_id";--> statement-breakpoint
ALTER TABLE "yjs_documents" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
-- A row from before every write set the column reads as seen at its creation, as the retention sweep counted it.
UPDATE "push_subscriptions" SET "last_seen_at" = "created_at" WHERE "last_seen_at" IS NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "last_seen_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "yjs_updates" ALTER COLUMN "organization_id" SET NOT NULL;