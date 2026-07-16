import { getTableName } from 'drizzle-orm';
import type { AnyPgTable, PgColumn } from 'drizzle-orm/pg-core';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { labelsTable } from '#/modules/label/label-db';
import { inactiveMembershipsTable } from '#/modules/memberships/inactive-memberships-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { requestsTable } from '#/modules/requests/requests-db';
import { tasksTable } from '#/modules/task/task-db';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { usersTable } from '#/modules/user/user-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';

// Base table shape constraints for generic resolvers
export type TableWithId = AnyPgTable & { id: PgColumn };
export type TableWithIdAndSlug = TableWithId & { slug: PgColumn };
export type ResolvableTable = TableWithId | TableWithIdAndSlug;

/** Entity-to-table mapping. `satisfies` enforces shape without widening literal keys/values. */
export const entityTables = {
  user: usersTable,
  organization: organizationsTable,
  attachment: attachmentsTable,
  project: projectsTable,
  workspace: workspacesTable,
  task: tasksTable,
  label: labelsTable,
} as const satisfies Record<string, ResolvableTable>;

/** Entity type keys of the table registry. */
export type EntityType = keyof typeof entityTables;
/** Row model of an entity table by entity type key. */
export type EntityModel<T extends EntityType> = (typeof entityTables)[T]['$inferSelect'];

/** Resource types that are not entities but have activities logged. */
export const resourceTypes = ['request', 'membership', 'inactive_membership', 'tenant'] as const;

/** Resource-to-table mapping. */
export const resourceTables = {
  request: requestsTable,
  membership: membershipsTable,
  inactive_membership: inactiveMembershipsTable,
  tenant: tenantsTable,
} as const satisfies Record<string, TableWithId>;

// Derived types from the table registries above
type AllTrackedTables = typeof entityTables & typeof resourceTables;
export type TrackedType = keyof AllTrackedTables;
export type TrackedModel<T extends TrackedType> = AllTrackedTables[T]['$inferSelect'];

/** Type-safe entity table lookup by entity type key. */
export function getEntityTable<T extends keyof typeof entityTables>(entityType: T): (typeof entityTables)[T] {
  return entityTables[entityType];
}

// Derived table name arrays for activity/CDC
export const entityTableNames = Object.values(entityTables).map((t) => getTableName(t));
export const resourceTableNames = Object.values(resourceTables).map((t) => getTableName(t));
export const activityTableNames = [...entityTableNames, ...resourceTableNames];
