import { and, count, eq, getColumns, ilike, inArray, type SQL, sql } from 'drizzle-orm';
import type { AuthContext, DbContext } from '#/core/context';
import { channelCountersTable } from '#/modules/entities/channel-counters-db';
import { getChannelCountsSelect } from '#/modules/entities/entities-queries';
import { membershipBaseSelect } from '#/modules/memberships/helpers/select';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { auditUserSelect, createdByUser, updatedByUser } from '#/modules/user/helpers/audit-user';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { getOrderColumn } from '#/utils/order-column';
import { prepareStringForILikeFilter } from '#/utils/sql';

interface InsertWorkspacesOpts {
  workspaces: (typeof workspacesTable.$inferInsert)[];
}

/** Insert workspaces and return the created rows. */
export const insertWorkspaces = async ({ var: { db } }: DbContext, { workspaces }: InsertWorkspacesOpts) => {
  return db.insert(workspacesTable).values(workspaces).returning();
};

interface UpdateWorkspaceOpts {
  id: string;
  values: Partial<typeof workspacesTable.$inferInsert>;
}

/** Update a workspace by ID and return the updated row. */
export const updateWorkspace = async (ctx: AuthContext, { id, values }: UpdateWorkspaceOpts) => {
  const { db, organizationId } = ctx.var;
  const [updated] = await db
    .update(workspacesTable)
    .set(values)
    .where(and(eq(workspacesTable.id, id), eq(workspacesTable.organizationId, organizationId)))
    .returning();
  return updated;
};

interface DeleteWorkspacesByIdsOpts {
  ids: string[];
}

/** Delete workspaces by IDs. */
export const deleteWorkspacesByIds = async (ctx: AuthContext, { ids }: DeleteWorkspacesByIdsOpts) => {
  const { db, organizationId } = ctx.var;
  return db
    .delete(workspacesTable)
    .where(and(inArray(workspacesTable.id, ids), eq(workspacesTable.organizationId, organizationId)));
};

interface GetWorkspacesListOpts {
  userId: string;
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  excludeArchived?: boolean;
  role?: 'admin' | 'member' | 'guest';
  includeCounts: boolean;
}

/** Get paginated list of workspaces with total count, membership, optional entity counts. */
export const getWorkspacesList = async ({ var: { db } }: DbContext, opts: GetWorkspacesListOpts) => {
  const { userId, q, sort, order, offset, limit, organizationId, excludeArchived, role, includeCounts } = opts;

  const entityType = 'workspace';

  // Base membership join key (attach membership for current user)
  const membershipKeyOn = and(
    eq(membershipsTable.workspaceId, workspacesTable.id),
    eq(membershipsTable.userId, userId),
    eq(membershipsTable.channelType, entityType),
  );

  // Membership filters (role/archived) in JOIN ON
  const membershipFilterOn = and(
    ...(excludeArchived ? [eq(membershipsTable.archived, false)] : []),
    ...(role ? [eq(membershipsTable.role, role)] : []),
  );

  const membershipOn = and(membershipKeyOn, membershipFilterOn);

  // Workspace filters in WHERE
  const workspaceWhere: SQL[] = [
    ...(q ? [ilike(workspacesTable.name, prepareStringForILikeFilter(q))] : []),
    ...(organizationId ? [eq(workspacesTable.organizationId, organizationId)] : []),
  ];

  // Count total
  const baseQuery = db
    .select({ workspaceId: workspacesTable.id })
    .from(workspacesTable)
    .innerJoin(membershipsTable, membershipOn)
    .where(and(...workspaceWhere))
    .as('base');

  const [{ total }] = await db.select({ total: count() }).from(baseQuery);

  const countData = includeCounts ? getChannelCountsSelect(entityType) : null;

  const orderColumn = getOrderColumn(sort, workspacesTable.id, order, {
    id: workspacesTable.id,
    name: workspacesTable.name,
    createdAt: workspacesTable.createdAt,
    displayOrder: membershipsTable.displayOrder,
  });

  const { createdBy: _cb, updatedBy: _mb, ...workspaceCols } = getColumns(workspacesTable);
  const selectShape = {
    ...workspaceCols,
    ...auditUserSelect,
    membership: membershipBaseSelect,
    ...(countData && { counts: countData.countsSelect }),
  } as const;

  // Build query - only join count subqueries when includeCounts is true
  let query = db.select(selectShape).from(workspacesTable).innerJoin(membershipsTable, membershipOn).$dynamic();

  if (countData) {
    query = query.leftJoin(
      channelCountersTable,
      sql`${workspacesTable.id}::text = ${channelCountersTable.channelKey}`,
    ) as typeof query;
  }

  const workspaces = await query
    .leftJoin(createdByUser, eq(createdByUser.id, workspacesTable.createdBy))
    .leftJoin(updatedByUser, eq(updatedByUser.id, workspacesTable.updatedBy))
    .where(and(...workspaceWhere))
    .orderBy(orderColumn)
    .limit(limit)
    .offset(offset);

  return { workspaces, total };
};
