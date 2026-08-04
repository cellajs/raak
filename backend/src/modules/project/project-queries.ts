import { and, count, eq, getColumns, ilike, inArray, max, type SQL, sql } from 'drizzle-orm';
import type { ChannelEntityType, EntityRole } from 'shared';
import type { ToolsConfig } from 'shared/tools-config';
import type { AuthContext, DbContext } from '#/core/context';
import { resolveListTotal } from '#/db/utils/list-total';
import { channelCountersTable } from '#/modules/entities/channel-counters-db';
import { getChannelCountsSelect } from '#/modules/entities/entities-queries';
import { membershipBaseSelect } from '#/modules/memberships/helpers/select';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { auditUserSelect, createdByUser, updatedByUser } from '#/modules/user/helpers/audit-user';
import { getOrderColumns } from '#/utils/order-column';
import { prepareStringForILikeFilter } from '#/utils/sql';

interface InsertProjectsOpts {
  projects: (typeof projectsTable.$inferInsert)[];
}

/** Insert projects and return the created rows. */
export const insertProjects = async (ctx: DbContext, { projects }: InsertProjectsOpts) => {
  const { db } = ctx.var;
  return db.insert(projectsTable).values(projects).returning();
};

interface UpdateProjectOpts {
  id: string;
  values: Partial<typeof projectsTable.$inferInsert> & { toolsConfig?: ToolsConfig };
}

/** Update a project by ID and return the updated row. Merges toolsConfig via jsonb || if provided. */
export const updateProject = async (ctx: AuthContext, { id, values }: UpdateProjectOpts) => {
  const { db, organizationId } = ctx.var;
  const { toolsConfig, ...rest } = values;

  const updateData = {
    ...rest,
    // Top-level jsonb merge: each listed slot key replaces that slot's stored arrangement wholesale
    ...(toolsConfig && {
      toolsConfig: sql`${projectsTable.toolsConfig} || ${JSON.stringify(toolsConfig)}::jsonb`,
    }),
  };

  const [updated] = await db
    .update(projectsTable)
    .set(updateData)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.organizationId, organizationId)))
    .returning();
  return updated;
};

interface DeleteProjectsByIdsOpts {
  ids: string[];
}

/** Delete projects by IDs. */
export const deleteProjectsByIds = async (ctx: AuthContext, { ids }: DeleteProjectsByIdsOpts) => {
  const { db, organizationId } = ctx.var;
  return db
    .delete(projectsTable)
    .where(and(inArray(projectsTable.id, ids), eq(projectsTable.organizationId, organizationId)));
};

interface FindMaxDisplayOrderOpts {
  userId: string;
  channelType: ChannelEntityType;
  workspaceId: string;
}

/** Find the max displayOrder for a user's memberships in a workspace. */
export const findMaxDisplayOrder = async (
  ctx: DbContext,
  { userId, channelType, workspaceId }: FindMaxDisplayOrderOpts,
) => {
  const { db } = ctx.var;
  const [{ maxOrder }] = await db
    .select({ maxOrder: max(membershipsTable.displayOrder) })
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.userId, userId),
        eq(membershipsTable.channelType, channelType),
        eq(membershipsTable.workspaceId, workspaceId),
      ),
    );
  return maxOrder;
};

interface DeleteProjectMembershipOpts {
  membershipId: string;
  userId: string;
  channelId: string;
  projectId: string;
}

/** Delete a project membership by its project identity. */
export const deleteProjectMembership = async (
  ctx: DbContext,
  { membershipId, userId, channelId, projectId }: DeleteProjectMembershipOpts,
) => {
  const { db } = ctx.var;
  return db
    .delete(membershipsTable)
    .where(
      and(
        eq(membershipsTable.id, membershipId),
        eq(membershipsTable.userId, userId),
        eq(membershipsTable.channelType, 'project'),
        eq(membershipsTable.channelId, channelId),
        eq(membershipsTable.projectId, projectId),
      ),
    );
};

interface InsertProjectMembershipOpts {
  values: typeof membershipsTable.$inferInsert;
}

/** Insert a new project membership and return with base select. */
export const insertProjectMembership = async (ctx: DbContext, { values }: InsertProjectMembershipOpts) => {
  const { db } = ctx.var;
  const [membership] = await db.insert(membershipsTable).values(values).returning(membershipBaseSelect);
  return membership;
};

interface FindProjectsPaginatedOpts {
  userId: string;
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  workspaceId?: string;
  excludeArchived?: boolean;
  role?: EntityRole;
  includeCounts: boolean;
}

/** Get paginated list of projects with total count, membership, optional entity counts. */
export const findProjectsPaginated = async (ctx: DbContext, opts: FindProjectsPaginatedOpts) => {
  const { db } = ctx.var;
  const { userId, q, sort, order, offset, limit, organizationId, workspaceId, excludeArchived, role, includeCounts } =
    opts;

  const entityType = 'project';

  // Base membership join key (attach membership for current user)
  const membershipKeyOn = and(
    eq(membershipsTable.projectId, projectsTable.id),
    eq(membershipsTable.userId, userId),
    eq(membershipsTable.channelType, entityType),
  );

  // Membership filters (role/archived) in JOIN ON
  const membershipFilterOn = and(
    ...(excludeArchived ? [eq(membershipsTable.archived, false)] : []),
    ...(role ? [eq(membershipsTable.role, role)] : []),
  );

  const membershipOn = and(membershipKeyOn, membershipFilterOn);

  // Project filters in WHERE
  const projectWhere: SQL[] = [
    ...(q ? [ilike(projectsTable.name, prepareStringForILikeFilter(q))] : []),
    ...(organizationId ? [eq(projectsTable.organizationId, organizationId)] : []),
    ...(workspaceId ? [eq(membershipsTable.workspaceId, workspaceId)] : []),
  ];

  const baseQuery = db
    .select({ projectId: projectsTable.id })
    .from(projectsTable)
    .innerJoin(membershipsTable, membershipOn)
    .where(and(...projectWhere));

  const orderBy = getOrderColumns({
    sort,
    order,
    fallback: ['displayOrder', 'asc'],
    columns: {
      id: projectsTable.id,
      name: projectsTable.name,
      createdAt: projectsTable.createdAt,
      displayOrder: membershipsTable.displayOrder,
    },
    tieBreaker: projectsTable.id,
  });

  const countData = includeCounts ? getChannelCountsSelect(entityType) : null;

  const { createdBy: _cb, updatedBy: _mb, ...projectCols } = getColumns(projectsTable);
  const selectShape = {
    ...projectCols,
    ...auditUserSelect,
    membership: membershipBaseSelect,
    ...(countData && { counts: countData.countsSelect }),
  } as const;

  // Build query - only join count subqueries when includeCounts is true
  let query = db.select(selectShape).from(projectsTable).innerJoin(membershipsTable, membershipOn).$dynamic();

  if (countData) {
    query = query.leftJoin(
      channelCountersTable,
      sql`${projectsTable.id}::text = ${channelCountersTable.channelKey}`,
    ) as typeof query;
  }

  const itemsQuery = query
    .leftJoin(createdByUser, eq(createdByUser.id, projectsTable.createdBy))
    .leftJoin(updatedByUser, eq(updatedByUser.id, projectsTable.updatedBy))
    .where(and(...projectWhere))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  return resolveListTotal(itemsQuery, {
    kind: 'exact',
    getTotal: async () => {
      const [{ total }] = await db.select({ total: count() }).from(baseQuery.as('projects'));
      return total;
    },
  });
};
