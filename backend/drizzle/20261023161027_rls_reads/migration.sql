CREATE INDEX "attachments_organization_id_created_at_index" ON "attachments" ("organization_id","created_at","id");--> statement-breakpoint
CREATE INDEX "labels_organization_id_name_index" ON "labels" ("organization_id","name","id");--> statement-breakpoint
ALTER POLICY "attachments_select_policy" ON "attachments" TO public USING (
    
  COALESCE((SELECT current_setting('app.tenant_id', true)), '') != ''
  AND "attachments"."tenant_id" = (SELECT current_setting('app.tenant_id', true))

    AND ("attachments"."deleted_at" IS NULL OR (SELECT current_setting('app.include_deleted', true)) = 'true')
  );--> statement-breakpoint
ALTER POLICY "labels_select_policy" ON "labels" TO public USING (
    
  COALESCE((SELECT current_setting('app.tenant_id', true)), '') != ''
  AND "labels"."tenant_id" = (SELECT current_setting('app.tenant_id', true))

    AND ("labels"."deleted_at" IS NULL OR (SELECT current_setting('app.include_deleted', true)) = 'true')
  );--> statement-breakpoint
ALTER POLICY "tasks_select_policy" ON "tasks" TO public USING (
    
  COALESCE((SELECT current_setting('app.tenant_id', true)), '') != ''
  AND "tasks"."tenant_id" = (SELECT current_setting('app.tenant_id', true))

    AND ("tasks"."deleted_at" IS NULL OR (SELECT current_setting('app.include_deleted', true)) = 'true')
  );--> statement-breakpoint
ALTER POLICY "yjs_documents_select_policy" ON "yjs_documents" TO public USING (
    
  COALESCE((SELECT current_setting('app.tenant_id', true)), '') != ''
  AND "yjs_documents"."tenant_id" = (SELECT current_setting('app.tenant_id', true))

    
  );--> statement-breakpoint
ALTER POLICY "yjs_updates_select_policy" ON "yjs_updates" TO public USING (
    
  COALESCE((SELECT current_setting('app.tenant_id', true)), '') != ''
  AND "yjs_updates"."tenant_id" = (SELECT current_setting('app.tenant_id', true))

    
  );