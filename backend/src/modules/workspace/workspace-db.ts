import { foreignKey, index, snakeCase, unique, uuid } from 'drizzle-orm/pg-core';
import { channelEntityColumns } from '#/db/utils/channel-entity-columns';
import { organizationsTable } from '#/modules/organization/organization-db';

/**
 * Workspaces table is a personal channel entity table.
 * Each workspace belongs to exactly one organization and inherits its tenant (RLS isolation boundary),
 * and is owned by a single user (not shared with others).
 */
export const workspacesTable = snakeCase.table(
  'workspaces',
  {
    ...channelEntityColumns('workspace'),
    organizationId: uuid().notNull(),
  },
  (table) => [
    index('workspaces_name_index').on(table.name.desc()),
    index('workspaces_created_at_index').on(table.createdAt.desc()),
    index('workspaces_tenant_id_index').on(table.tenantId),
    index('workspaces_organization_id_index').on(table.organizationId),
    index('workspaces_created_by_index').on(table.createdBy),
    index('workspaces_updated_by_index').on(table.updatedBy),
    unique('workspaces_tenant_id_unique').on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }).onDelete('cascade'),
  ],
);

export type WorkspaceModel = typeof workspacesTable.$inferSelect;
export type InsertWorkspaceModel = typeof workspacesTable.$inferInsert;
