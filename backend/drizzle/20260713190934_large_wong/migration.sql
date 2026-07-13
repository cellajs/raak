ALTER TABLE "inactive_memberships" ADD COLUMN "reminded_at" timestamp;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "published_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "published_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "published_at" timestamp DEFAULT now();