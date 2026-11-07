ALTER TABLE "sandboxes" ADD COLUMN "share_code" varchar(16) DEFAULT substr(md5(gen_random_uuid()::text), 1, 16) NOT NULL;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD COLUMN "guest_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sandboxes_share_code_index" ON "sandboxes" ("share_code");