ALTER TABLE "attachments" RENAME COLUMN "public" TO "public_bucket";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "labels" DROP COLUMN "path";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "path";