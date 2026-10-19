DROP INDEX "attachments_created_by_index";--> statement-breakpoint
CREATE INDEX "attachments_created_by_index" ON "attachments" ("created_by","organization_id");--> statement-breakpoint
DROP INDEX "labels_created_by_index";--> statement-breakpoint
CREATE INDEX "labels_created_by_index" ON "labels" ("created_by","organization_id");--> statement-breakpoint
DROP INDEX "tasks_created_by_index";--> statement-breakpoint
CREATE INDEX "tasks_created_by_index" ON "tasks" ("created_by","organization_id");