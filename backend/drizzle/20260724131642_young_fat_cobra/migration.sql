ALTER TABLE "labels" ADD COLUMN "mode" varchar(255) DEFAULT 'secondary' NOT NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
UPDATE "labels" SET "slug" = trim(both '-' from regexp_replace(regexp_replace(regexp_replace(lower(btrim("name")), '\s+', '-', 'g'), '[^a-z0-9-]', '', 'g'), '-+', '-', 'g'));--> statement-breakpoint
ALTER TABLE "labels" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "icon" varchar(255);--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "organization_tracked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "display_order" double precision;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_project_primary_slug_unique" ON "labels" ("project_id","slug") WHERE "mode" = 'primary' AND "deleted_at" IS NULL;