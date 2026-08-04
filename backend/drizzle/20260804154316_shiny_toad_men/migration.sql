ALTER TABLE "projects" ADD COLUMN "tools_config" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "tools_config" jsonb DEFAULT '{}' NOT NULL;