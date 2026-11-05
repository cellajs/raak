import { getTableName } from 'drizzle-orm';
import { numberedProductTypes, productNumberingTable } from '#/modules/numbering/numbering-db';
import { getEntityTable } from '#/tables';
import type { SideEffectBlock, SideEffectProducer } from '../types';

export const assignNumberFunctionName = 'assign_product_number';
export const numberTriggerName = (tableName: string) => `${tableName}_number_trigger`;

/**
 * Numbers the rows of each numbered product type per organization. A row inserted at 0, which is what the client
 * placeholder and every insert path send, takes the next value of its organization's counter row; the upsert's row
 * lock serializes concurrent inserts of one organization, and each table's unique index is the backstop. A number above 0 passes
 * through, so a backfill or an import can bring its own. The UPDATE branch keeps a number where it is.
 */
function run(): SideEffectBlock {
  const counter = getTableName(productNumberingTable);
  const tables = numberedProductTypes.map((type) => getTableName(getEntityTable(type)));

  const triggers = tables
    .map(
      (table) => `DROP TRIGGER IF EXISTS ${numberTriggerName(table)} ON ${table};
--> statement-breakpoint
CREATE TRIGGER ${numberTriggerName(table)} BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION ${assignNumberFunctionName}();`,
    )
    .join('\n--> statement-breakpoint\n');

  const migrationSql = `-- Product numbering: the next per-organization number for a row inserted at 0
CREATE OR REPLACE FUNCTION ${assignNumberFunctionName}() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.number IS DISTINCT FROM OLD.number THEN
      RAISE EXCEPTION 'Cannot modify number on %', TG_TABLE_NAME;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.number IS NOT NULL AND NEW.number > 0 THEN
    RETURN NEW;
  END IF;
  INSERT INTO ${counter} (tenant_id, organization_id, product_type, last_number)
  VALUES (NEW.tenant_id, NEW.organization_id, NEW.entity_type, 1)
  ON CONFLICT (organization_id, product_type)
  DO UPDATE SET last_number = ${counter}.last_number + 1
  RETURNING last_number INTO NEW.number;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
${triggers}`;

  return {
    tag: 'product_numbering',
    title: 'Product numbering, assign_product_number trigger per numbered table',
    sql: migrationSql,
    notes: [`Numbered tables (${tables.length}): ${tables.join(', ')}`],
  };
}

export const sideEffect: SideEffectProducer = {
  name: 'Product numbering',
  produce: run,
};
