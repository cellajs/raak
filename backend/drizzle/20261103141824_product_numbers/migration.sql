CREATE TABLE "product_numbering" (
	"tenant_id" varchar(24) NOT NULL,
	"organization_id" uuid,
	"product_type" varchar,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_numbering_pkey" PRIMARY KEY("organization_id","product_type")
);
--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing rows take their number in creation order per organization, tombstones included, so no live row ever shares
-- a number with a deleted one. The trigger of the side-effects migration numbers every later insert.
-- changedFields goes so the CDC worker attributes the write from the WAL diff, not from a row's last edit.
-- No RLS wrapper: the migrate role owns these tables and RLS is not forced (10-rls side effect).
UPDATE "tasks" SET "number" = numbered.n, "stx" = "stx" - 'changedFields'
FROM (SELECT id, row_number() OVER (PARTITION BY organization_id ORDER BY created_at, id) AS n FROM "tasks") AS numbered
WHERE "tasks".id = numbered.id;--> statement-breakpoint
UPDATE "labels" SET "number" = numbered.n, "stx" = "stx" - 'changedFields'
FROM (SELECT id, row_number() OVER (PARTITION BY organization_id ORDER BY created_at, id) AS n FROM "labels") AS numbered
WHERE "labels".id = numbered.id;--> statement-breakpoint
INSERT INTO "product_numbering" ("tenant_id", "organization_id", "product_type", "last_number")
SELECT tenant_id, organization_id, 'task', max(number) FROM "tasks" GROUP BY tenant_id, organization_id
UNION ALL
SELECT tenant_id, organization_id, 'label', max(number) FROM "labels" GROUP BY tenant_id, organization_id;--> statement-breakpoint
-- A backfill that left a row at 0 has to stop the deploy: the unique index would refuse the second such row of an organization.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "tasks" WHERE "number" = 0) OR EXISTS (SELECT 1 FROM "labels" WHERE "number" = 0) THEN
    RAISE EXCEPTION 'product numbers: a task or label is still at 0 after the backfill';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_organization_number_unique" ON "labels" ("organization_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_organization_number_unique" ON "tasks" ("organization_id","number");--> statement-breakpoint
ALTER TABLE "product_numbering" ADD CONSTRAINT "product_numbering_tenant_id_tenants_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id");--> statement-breakpoint
ALTER TABLE "product_numbering" ADD CONSTRAINT "product_numbering_itamjET4RDM6_fkey" FOREIGN KEY ("tenant_id","organization_id") REFERENCES "organizations"("tenant_id","id") ON DELETE CASCADE;
