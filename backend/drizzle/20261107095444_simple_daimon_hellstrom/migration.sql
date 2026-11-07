DROP INDEX "sandboxes_status_created_at_index";--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN "content_version";--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN "claimed_at";--> statement-breakpoint
ALTER TABLE "sandboxes" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "sandboxes_created_at_index" ON "sandboxes" ("created_at");--> statement-breakpoint
CREATE INDEX "sandboxes_expires_at_index" ON "sandboxes" ("expires_at");