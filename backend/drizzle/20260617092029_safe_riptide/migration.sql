CREATE TABLE "seen_counts" (
	"entity_id" uuid PRIMARY KEY,
	"entity_type" varchar NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_group_order";--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "pages_group_order" ON "pages" ("parent_id","display_order") WHERE "deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deleted_by_users_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER POLICY "chats_select_policy" ON "chats" TO public USING (
    
  COALESCE(current_setting('app.tenant_id', true), '') != ''
  AND "chats"."tenant_id" = current_setting('app.tenant_id', true)::text

    AND ("chats"."deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
  );--> statement-breakpoint
ALTER POLICY "labels_select_policy" ON "labels" TO public USING (
    
  COALESCE(current_setting('app.tenant_id', true), '') != ''
  AND "labels"."tenant_id" = current_setting('app.tenant_id', true)::text

    AND ("labels"."deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
  );--> statement-breakpoint
ALTER POLICY "messages_select_policy" ON "messages" TO public USING (
    
  COALESCE(current_setting('app.tenant_id', true), '') != ''
  AND "messages"."tenant_id" = current_setting('app.tenant_id', true)::text

    AND ("messages"."deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
  );--> statement-breakpoint
ALTER POLICY "tasks_select_policy" ON "tasks" TO public USING (
    
  COALESCE(current_setting('app.tenant_id', true), '') != ''
  AND "tasks"."tenant_id" = current_setting('app.tenant_id', true)::text

    AND ("tasks"."deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
  );--> statement-breakpoint
ALTER POLICY "attachments_select_policy" ON "attachments" TO public USING (
    
  COALESCE(current_setting('app.tenant_id', true), '') != ''
  AND "attachments"."tenant_id" = current_setting('app.tenant_id', true)::text

    AND ("attachments"."deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
  );--> statement-breakpoint
ALTER POLICY "yjs_documents_select_policy" ON "yjs_documents" TO public USING (
    
  COALESCE(current_setting('app.tenant_id', true), '') != ''
  AND "yjs_documents"."tenant_id" = current_setting('app.tenant_id', true)::text

    
  );