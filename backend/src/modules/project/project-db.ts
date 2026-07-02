import { foreignKey, index, snakeCase, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { contextEntityColumns } from '#/db/utils/context-entity-columns';
import { organizationsTable } from '#/modules/organization/organization-db';

/**
 * Projects table is a context entity table.
 * Each project belongs to exactly one organization and inherits its tenant (RLS isolation boundary).
 */
export const projectsTable = snakeCase.table(
  'projects',
  {
    ...contextEntityColumns('project'),
    publicAt: timestamp({ mode: 'string' }),
    organizationId: uuid().notNull(),
  },
  (table) => [
    index('projects_name_index').on(table.name.desc()),
    index('projects_created_at_index').on(table.createdAt.desc()),
    index('projects_tenant_id_index').on(table.tenantId),
    index('projects_organization_id_index').on(table.organizationId),
    index('projects_created_by_index').on(table.createdBy),
    index('projects_updated_by_index').on(table.updatedBy),
    // Compound unique for composite FK targets (memberships, products reference this)
    unique('projects_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }).onDelete('cascade'),
  ],
);

export type ProjectModel = typeof projectsTable.$inferSelect;
export type InsertProjectModel = typeof projectsTable.$inferInsert;
