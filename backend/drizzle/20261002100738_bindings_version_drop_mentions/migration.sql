ALTER TABLE "actors" ADD COLUMN "bindings_version" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "mentions";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "mentions";