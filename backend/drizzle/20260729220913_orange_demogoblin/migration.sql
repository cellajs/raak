-- Fold the per-variant key columns into the keys jsonb BEFORE dropping them:
-- without this backfill every existing attachment loses its storage pointers.
-- RLS off around it: the migrate role has no BYPASSRLS on managed Postgres,
-- and an UPDATE reading existing columns also applies the tenant SELECT
-- policy, which matches zero rows in a migration session.
ALTER TABLE "attachments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "keys" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "attachments" SET "keys" = jsonb_strip_nulls(jsonb_build_object(
  'original', "original_key",
  'converted', "converted_key",
  'thumbnail', "thumbnail_key"
));--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "original_key";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "converted_key";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "thumbnail_key";--> statement-breakpoint
ALTER TABLE "attachments" DROP COLUMN "thumbnail_tiny_key";--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;
