import { sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  foreignKey,
  index,
  integer,
  snakeCase,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantSelectPolicy, writeThroughPolicies } from '#/db/rls-helpers';
import { maxLength } from '#/db/utils/constraints';
import { productEntityColumns } from '#/db/utils/product-entity-columns';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';

/**
 * Tasks table is a product entity table.
 * Each task belongs to exactly one project and inherits its organization + tenant (RLS isolation boundary).
 */
export const tasksTable = snakeCase.table(
  'tasks',
  {
    ...productEntityColumns('task'),
    expandable: boolean().default(false).notNull(),
    summary: varchar({ length: maxLength.html }).notNull(),
    summaryLength: integer().default(0).notNull(),
    variant: integer().notNull(),
    points: integer(),
    displayOrder: doublePrecision().notNull(),
    status: integer().notNull(),
    statusChangedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
    labels: text().array().notNull().default(sql`'{}'::text[]`),
    assignedTo: text().array().notNull().default(sql`'{}'::text[]`),
    checkboxCount: integer().default(0).notNull(),
    checkedCount: integer().default(0).notNull(),
    attachmentCount: integer().default(0).notNull(),
    // publicAt comes from productEntityColumns (base column); non-member public read is gated on it.
    organizationId: uuid().notNull(),
    projectId: uuid()
      .notNull()
      .references(() => projectsTable.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('tasks_organization_id_index').on(table.organizationId),
    index('tasks_organization_id_seq_index').on(table.organizationId, table.seq),
    index('tasks_tenant_id_index').on(table.tenantId),
    index('tasks_created_by_index').on(table.createdBy),
    index('tasks_updated_by_index').on(table.updatedBy),
    index('tasks_project_status_index').on(table.projectId, table.status),
    index('idx_tasks_labels_gin').using('gin', table.labels),
    index('idx_tasks_assigned_to_gin').using('gin', table.assignedTo),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }).onDelete('cascade'),
    tenantSelectPolicy('tasks', table),
    ...writeThroughPolicies('tasks'),
  ],
);

export type TaskModel = typeof tasksTable.$inferSelect;
export type InsertTaskModel = typeof tasksTable.$inferInsert;
