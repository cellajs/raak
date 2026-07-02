DROP INDEX "workspace_name_index";--> statement-breakpoint
DROP INDEX "workspace_created_at_index";--> statement-breakpoint
CREATE INDEX "workspaces_name_index" ON "workspaces" ("name" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workspaces_created_at_index" ON "workspaces" ("created_at" DESC NULLS LAST);