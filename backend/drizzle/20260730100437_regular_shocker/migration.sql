DROP INDEX "attachments_task_id_index";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "attachments" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "attachment_count";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "task_id";--> statement-breakpoint
CREATE INDEX "idx_tasks_attachments_gin" ON "tasks" USING gin ("attachments");