import { getColumns } from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import { foreignKey, index, snakeCase, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenantSelectPolicy, writeThroughPolicies } from '#/db/rls-helpers';
import { maxLength } from '#/db/utils/constraints';
import { productEntityColumns } from '#/db/utils/product-entity-columns';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';

/**
 * Labels table is a lightweight product entity table.
 * Each label belongs to exactly one project and inherits its organization + tenant (RLS isolation boundary).
 */
export const labelsTable = snakeCase.table(
  'labels',
  {
    ...productEntityColumns('label'),
    color: varchar({ length: maxLength.field }),
    organizationId: uuid().notNull(),
    projectId: uuid()
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('labels_organization_id_index').on(table.organizationId),
    index('labels_project_seq_index').on(table.projectId, table.seq),
    index('labels_tenant_id_index').on(table.tenantId),
    index('labels_created_by_index').on(table.createdBy),
    index('labels_updated_by_index').on(table.updatedBy),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }).onDelete('cascade'),
    tenantSelectPolicy('labels', table),
    ...writeThroughPolicies('labels'),
  ],
);

// Get table columns and convert to snake_case
export const labelsTableColumns = Object.fromEntries(
  Object.entries(getColumns(labelsTable)).map(([key, column]) => [toSnakeCase(column.name), key]),
);

export type LabelModel = typeof labelsTable.$inferSelect;
export type InsertLabelModel = typeof labelsTable.$inferInsert;
