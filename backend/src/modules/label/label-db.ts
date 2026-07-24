import { getColumns, sql } from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
  snakeCase,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { LabelMode } from 'shared';
import { tenantSelectPolicy, writeThroughPolicies } from '#/db/rls-helpers';
import { maxLength } from '#/db/utils/constraints';
import { productColumns } from '#/db/utils/product-columns';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';

/**
 * Labels table is a lightweight product entity table.
 * Each label belongs to exactly one project and inherits its organization + tenant (RLS isolation boundary).
 * `mode` distinguishes primary (task type), secondary (free-form tag) and epic (grouping) labels.
 * `slug` is the label's stable identity for cross-project matching and organization tracking;
 * `organizationTracked` marks primary rows still in sync with the organization's setupConfig.
 */
export const labelsTable = snakeCase.table(
  'labels',
  {
    ...productColumns('label'),
    color: varchar({ length: maxLength.field }),
    mode: varchar({ length: maxLength.field }).notNull().default('secondary').$type<LabelMode>(),
    slug: varchar({ length: maxLength.field }).notNull(),
    icon: varchar({ length: maxLength.field }),
    organizationTracked: boolean().notNull().default(false),
    displayOrder: doublePrecision(),
    organizationId: uuid().notNull(),
    projectId: uuid()
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // One live primary label per slug within a project; secondary/epic labels are exempt.
    uniqueIndex('labels_project_primary_slug_unique')
      .on(table.projectId, table.slug)
      .where(sql`${table.mode} = 'primary' AND ${table.deletedAt} IS NULL`),
    index('labels_organization_id_index').on(table.organizationId),
    index('labels_organization_id_seq_index').on(table.organizationId, table.seq),
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
