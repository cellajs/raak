import { integer, primaryKey, snakeCase, uuid, varchar } from 'drizzle-orm/pg-core';
import type { ProductEntityType } from 'shared';
import { tenantIdLength } from '#/db/utils/constraints';
import { organizationForeignKey } from '#/db/utils/organization-foreign-key';
import { tenantsTable } from '#/modules/tenants/tenants-db';

/** The product types whose rows carry a `number`, each counted apart. */
export const numberedProductTypes = ['task', 'label'] as const satisfies readonly ProductEntityType[];

/** The last number handed out per organization and product type; `assign_product_number()` is its only writer. */
export const productNumberingTable = snakeCase.table(
  'product_numbering',
  {
    tenantId: varchar({ length: tenantIdLength })
      .notNull()
      .references(() => tenantsTable.id),
    organizationId: uuid().notNull(),
    productType: varchar({ enum: numberedProductTypes }).notNull(),
    lastNumber: integer().notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.productType] }), organizationForeignKey(table)],
);
