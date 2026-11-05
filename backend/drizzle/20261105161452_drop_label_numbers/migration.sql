-- The trigger reads NEW.number on every label write, so it goes before the column. The side-effects producer no
-- longer creates it, but it never drops a trigger it stopped emitting.
DROP TRIGGER IF EXISTS "labels_number_trigger" ON "labels";--> statement-breakpoint
DELETE FROM "product_numbering" WHERE "product_type" = 'label';--> statement-breakpoint
DROP INDEX "labels_organization_number_unique";--> statement-breakpoint
ALTER TABLE "labels" DROP COLUMN "number";
