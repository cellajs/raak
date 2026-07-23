DROP INDEX "attachments_task_id_index";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "attachments" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
-- Backfill the derived host arrays from the legacy task_id pointer before dropping it.
-- Description media blocks get their attachmentId props stamped separately by
-- backend/scripts/backfill-attachment-refs.ts (JSON rewrite is not expressible here).
UPDATE "tasks" t
SET "attachments" = sub.ids
FROM (
	SELECT "task_id", array_agg("id" ORDER BY "created_at") AS ids
	FROM "attachments"
	WHERE "task_id" IS NOT NULL AND "deleted_at" IS NULL
	GROUP BY "task_id"
) sub
WHERE t."id" = sub."task_id";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "task_id";--> statement-breakpoint
CREATE INDEX "idx_tasks_attachments_gin" ON "tasks" USING gin ("attachments");
