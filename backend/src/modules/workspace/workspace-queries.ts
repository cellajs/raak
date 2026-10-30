import { and, count, eq, getColumns, inArray, ne, type SQL, sql } from 'drizzle-orm';
import type { EntityRole } from 'shared';
import type { ActorContext, DbContext } from '#/core/context';
import type { UserId } from '#/db/utils/ids';
import { resolveListTotal } from '#/db/utils/list-total';
import { requestScopeWhere } from '#/db/utils/request-scope';
import { updateStamps } from '#/db/utils/stamps';
import { channelCountersTable } from '#/modules/entities/channel-counters-db';
import { getChannelCountsSelect } from '#/modules/entities/entities-queries';
import { membershipBaseSelect } from '#/modules/memberships/helpers/select';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { type InsertWorkspaceModel, workspacesTable } from '#/modules/workspace/workspace-db';
import { getOrderColumns } from '#/utils/order-column';
import { searchFilter } from '#/utils/sql';

interface InsertWorkspacesOpts {
  workspaces: InsertWorkspaceModel[];
}

/** Insert workspaces and return the created rows. */
export const insertWorkspaces = async (ctx: DbContext, { workspaces }: InsertWorkspacesOpts) => {
  const { db } = ctx.var;
  return db.insert(workspacesTable).values(workspaces).returning();
};

interface UpdateWorkspaceOpts {
  id: string;
  values: Partial<InsertWorkspaceModel>;
}

/** Update a workspace by ID and return the updated row. */
export const updateWorkspace = async (ctx: ActorContext, { id, values }: UpdateWorkspaceOpts) => {
  const { db } = ctx.var;
  const [updated] = await db
    .update(workspacesTable)
    .set(values)
    .where(and(eq(workspacesTable.id, id), requestScopeWhere(ctx, workspacesTable, 'workspace')))
    .returning();
  return updated;
};

interface DeleteWorkspacesByIdsOpts {
  ids: string[];
}

/** Deletes the workspaces of the request's organization by id. */
export const deleteWorkspacesByIds = async (ctx: ActorContext, { ids }: DeleteWorkspacesByIdsOpts) => {
  const { db } = ctx.var;
  return db.delete(workspacesTable).where(and(inArray(workspacesTable.id, ids), requestScopeWhere(ctx, workspacesTable, 'workspace')));
};

interface UnfileWorkspaceMembershipsOpts {
  ids: string[];
  updatedBy: UserId;
}

/**
 * Takes the memberships filed under the workspaces out of them, so a workspace delete cascades only to the memberships
 * of the workspaces themselves. `workspace_id` is immutable (`memberships_immutable_keys`), so a copy replaces each row.
 * @returns The users holding any membership under the workspaces, the workspaces' members included.
 */
export const unfileWorkspaceMemberships = async (ctx: ActorContext, { ids, updatedBy }: UnfileWorkspaceMembershipsOpts) => {
  const { db } = ctx.var;
  const underWorkspaces = and(inArray(membershipsTable.workspaceId, ids), requestScopeWhere(ctx, membershipsTable));
  const holders = await db.selectDistinct({ userId: membershipsTable.userId }).from(membershipsTable).where(underWorkspaces);
  const filed = await db
    .delete(membershipsTable)
    .where(and(underWorkspaces, ne(membershipsTable.channelType, 'workspace')))
    .returning();
  if (filed.length) {
    await db
      .insert(membershipsTable)
      .values(filed.map(({ id, ...membership }) => ({ ...membership, workspaceId: null, ...updateStamps(updatedBy) })));
  }
  return holders.map(({ userId }) => userId);
};

interface FindWorkspacesPaginatedOpts {
  userId: string;
  /** Lists the workspaces of archived tenants too. */
  isSystemAdmin: boolean;
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  excludeArchived?: boolean;
  role?: EntityRole;
  includeCounts: boolean;
}

/** Get paginated list of workspaces with total count, membership, optional entity counts. */
export const findWorkspacesPaginated = async (ctx: DbContext, opts: FindWorkspacesPaginatedOpts) => {
  const { db } = ctx.var;
  const { userId, isSystemAdmin, q, sort, order, offset, limit, organizationId, excludeArchived, role, includeCounts } = opts;

  const entityType = 'workspace';

  const membershipKeyOn = and(
    eq(membershipsTable.workspaceId, workspacesTable.id),
    eq(membershipsTable.userId, userId),
    eq(membershipsTable.channelType, entityType),
  );

  const membershipFilterOn = and(
    ...(excludeArchived ? [eq(membershipsTable.archived, false)] : []),
    ...(role ? [eq(membershipsTable.role, role)] : []),
  );

  const membershipOn = and(membershipKeyOn, membershipFilterOn);

  // An archived tenant's workspaces list for system admins only, as its organization does
  const search = searchFilter([workspacesTable.name], q);
  const workspaceWhere: SQL[] = [
    ...(isSystemAdmin
      ? []
      : [
          sql`NOT EXISTS (SELECT 1 FROM ${tenantsTable} WHERE ${tenantsTable.id} = ${workspacesTable.tenantId} AND ${tenantsTable.status} = 'archived')`,
        ]),
    ...(search ? [search] : []),
    ...(organizationId ? [eq(workspacesTable.organizationId, organizationId)] : []),
  ];

  const baseQuery = db
    .select({ workspaceId: workspacesTable.id })
    .from(workspacesTable)
    .innerJoin(membershipsTable, membershipOn)
    .where(and(...workspaceWhere));

  const countData = includeCounts ? getChannelCountsSelect(entityType) : null;

  const orderBy = getOrderColumns({
    sort,
    order,
    fallback: ['displayOrder', 'asc'],
    columns: {
      id: workspacesTable.id,
      name: workspacesTable.name,
      createdAt: workspacesTable.createdAt,
      displayOrder: membershipsTable.displayOrder,
    },
    tieBreaker: workspacesTable.id,
  });

  // Writer ids stay ids here; the operation resolves them to references for the page (`withActorRefs`).
  const selectShape = {
    ...getColumns(workspacesTable),
    membership: membershipBaseSelect,
    ...(countData && { counts: countData.countsSelect }),
  } as const;

  let query = db.select(selectShape).from(workspacesTable).innerJoin(membershipsTable, membershipOn).$dynamic();

  if (countData) {
    query = query.leftJoin(channelCountersTable, sql`${workspacesTable.id}::text = ${channelCountersTable.channelKey}`) as typeof query;
  }

  const itemsQuery = query
    .where(and(...workspaceWhere))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  return resolveListTotal(itemsQuery, {
    kind: 'exact',
    getTotal: async () => {
      const [{ total }] = await db.select({ total: count() }).from(baseQuery.as('workspaces'));
      return total;
    },
  });
};
