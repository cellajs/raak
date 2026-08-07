-- Fold task_id links into the tasks.attachments host array BEFORE dropping the
-- column: under the owned-embedding lifecycle, rows with no live host
-- reference are soft-deleted by the CDC GC. No-op without task attachments.
-- RLS off around it: the migrate role has no BYPASSRLS on managed Postgres,
-- and the backfill reads existing rows, so the tenant SELECT policies would
-- match zero rows in a migration session.
ALTER TABLE "attachments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "attachments_task_id_index";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "attachments" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
UPDATE "tasks" t SET "attachments" = sub.ids
FROM (
  SELECT "task_id", array_agg(id ORDER BY created_at) AS ids
  FROM "attachments"
  WHERE "task_id" IS NOT NULL AND "deleted_at" IS NULL
  GROUP BY "task_id"
) sub
WHERE sub."task_id" = t.id;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "attachment_count";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "task_id";--> statement-breakpoint
CREATE INDEX "idx_tasks_attachments_gin" ON "tasks" USING gin ("attachments");--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;
