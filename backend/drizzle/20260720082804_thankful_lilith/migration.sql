ALTER TABLE "seen_by" DROP CONSTRAINT "seen_by_user_entity_unique";--> statement-breakpoint
DROP INDEX "labels_project_seq_index";--> statement-breakpoint
DROP INDEX "tasks_project_seq_index";--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "path" text GENERATED ALWAYS AS ("organization_id"::text || COALESCE('/' || "project_id"::text, '')) STORED;--> statement-breakpoint
ALTER TABLE "channel_counters" ADD COLUMN "path" text;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "path" text GENERATED ALWAYS AS ("organization_id"::text || COALESCE('/' || "project_id"::text, '')) STORED;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "path" text GENERATED ALWAYS AS ("id"::text) STORED;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "organization_flags" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "path" text GENERATED ALWAYS AS ("organization_id"::text || '/' || "id"::text) STORED;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "path" text GENERATED ALWAYS AS ("organization_id"::text || COALESCE('/' || "project_id"::text, '')) STORED;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "path" text GENERATED ALWAYS AS ("organization_id"::text || '/' || "id"::text) STORED;--> statement-breakpoint
CREATE INDEX "labels_organization_id_seq_index" ON "labels" ("organization_id","seq");--> statement-breakpoint
CREATE INDEX "seen_by_user_entity_index" ON "seen_by" ("user_id","entity_id");--> statement-breakpoint
CREATE INDEX "tasks_organization_id_seq_index" ON "tasks" ("organization_id","seq");