ALTER TABLE "attachments" ADD COLUMN "task_id" uuid;--> statement-breakpoint
CREATE INDEX "attachments_task_id_index" ON "attachments" ("task_id");