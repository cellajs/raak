ALTER TABLE "tasks" ADD COLUMN "primary_label_id" uuid;--> statement-breakpoint
INSERT INTO "labels" (id, entity_type, tenant_id, organization_id, project_id, name, slug, color, icon, mode, organization_tracked, display_order, created_at, stx)
SELECT gen_random_uuid(), 'label', p.tenant_id, p.organization_id, p.id, v.name, v.slug, v.color, v.icon, 'primary', true, v.display_order, now(),
       jsonb_build_object('mutationId', gen_random_uuid(), 'sourceId', 'server', 'fieldTimestamps', '{}'::jsonb)
FROM "projects" p
CROSS JOIN (VALUES ('Feature', 'feature', 'amber', 'star', 1000.0), ('Chore', 'chore', 'slate', 'bolt', 1010.0), ('Bug', 'bug', 'red', 'bug', 1020.0)) AS v(name, slug, color, icon, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "labels" l
  WHERE l.project_id = p.id AND l.mode = 'primary' AND l.slug = v.slug AND l.deleted_at IS NULL
);--> statement-breakpoint
UPDATE "tasks" t SET "primary_label_id" = l.id
FROM "labels" l
WHERE l.project_id = t.project_id AND l.mode = 'primary' AND l.deleted_at IS NULL
  AND l.slug = CASE t.variant WHEN 1 THEN 'feature' WHEN 2 THEN 'chore' WHEN 3 THEN 'bug' ELSE 'feature' END;--> statement-breakpoint
UPDATE "tasks" t SET "primary_label_id" = (
  SELECT l.id FROM "labels" l
  WHERE l.project_id = t.project_id AND l.mode = 'primary' AND l.deleted_at IS NULL
  ORDER BY l.display_order ASC NULLS LAST LIMIT 1
) WHERE t."primary_label_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "primary_label_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "variant";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "points";--> statement-breakpoint
CREATE INDEX "tasks_primary_label_id_index" ON "tasks" ("primary_label_id");
