ALTER TABLE "attachments" DROP CONSTRAINT "attachments_project_id_projects_id_fkey";--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "project_id" SET NOT NULL;