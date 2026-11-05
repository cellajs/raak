ALTER TABLE "attachments" ALTER COLUMN "size" SET DATA TYPE bigint USING "size"::bigint;--> statement-breakpoint
ALTER TABLE "attachments" ALTER COLUMN "keys" DROP DEFAULT;