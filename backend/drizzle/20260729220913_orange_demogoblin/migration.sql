ALTER TABLE "attachments" ADD COLUMN "keys" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "original_key";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "converted_key";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "thumbnail_key";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "thumbnail_tiny_key";