import { and, count, eq, getColumns, inArray, max, type SQL, sql } from 'drizzle-orm';
import type { ChannelEntityType, EntityRole } from 'shared';
import type { ActorContext, DbContext } from '#/core/context';
import { AppError } from '#/core/error';
import { resolveListTotal } from '#/db/utils/list-total';
import { requestScopeWhere } from '#/db/utils/request-scope';
import { channelCountersTable } from '#/modules/entities/channel-counters-db';
import { getChannelCountsSelect } from '#/modules/entities/entities-queries';
import { membershipBaseSelect } from '#/modules/memberships/helpers/select';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { type InsertProjectModel, projectsTable } from '#/modules/project/project-db';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { buildChannelListReadWhere, type ChannelCollectionReadScope } from '#/permissions/channel-collection-scope';
import { getOrderColumns } from '#/utils/order-column';
import { textSearchFilter } from '#/utils/sql';

interface InsertProjectsOpts {
  projects: InsertProjectModel[];
}

/** Insert projects and return the created rows. */
export const insertProjects = async (ctx: DbContext, { projects }: InsertProjectsOpts) => {
  const { db } = ctx.var;
  return db.insert(projectsTable).values(projects).returning();
};

interface UpdateProjectOpts {
  id: string;
  values: Partial<InsertProjectModel>;
}

/** Update a project by ID and return the updated row. */
export const updateProject = async (ctx: ActorContext, { id, values }: UpdateProjectOpts) => {
  const { db } = ctx.var;
  const [updated] = await db
    .update(projectsTable)
    .set(values)
    .where(and(eq(projectsTable.id, id), requestScopeWhere(ctx, projectsTable, 'project')))
    .returning();
  return updated;
};

interface DeleteProjectsByIdsOpts {
  ids: string[];
}

/** Deletes the projects of the request's organization by id. */
export const deleteProjectsByIds = async (ctx: ActorContext, { ids }: DeleteProjectsByIdsOpts) => {
  const { db } = ctx.var;
  return db.delete(projectsTable).where(and(inArray(projectsTable.id, ids), requestScopeWhere(ctx, projectsTable, 'project')));
};

interface FindMaxDisplayOrderOpts {
  userId: string;
  channelType: ChannelEntityType;
  workspaceId: string;
}

/** Find the max displayOrder for a user's memberships in a workspace. */
export const findMaxDisplayOrder = async (ctx: DbContext, { userId, channelType, workspaceId }: FindMaxDisplayOrderOpts) => {
  const { db } = ctx.var;
  const [{ maxOrder }] = await db
    .select({ maxOrder: max(membershipsTable.displayOrder) })
    .from(membershipsTable)
    .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.channelType, channelType), eq(membershipsTable.workspaceId, workspaceId)));
  return maxOrder;
};

interface DeleteProjectMembershipOpts {
  membershipId: string;
  userId: string;
}

/** Deletes a membership by id, only when it is the user's. */
export const deleteProjectMembership = async (ctx: DbContext, { membershipId, userId }: DeleteProjectMembershipOpts) => {
  const { db } = ctx.var;
  return db.delete(membershipsTable).where(and(eq(membershipsTable.id, membershipId), eq(membershipsTable.userId, userId)));
};

interface FindActorProjectsInWorkspaceOpts {
  workspaceId: string;
}

/** The projects whose membership of the actor is filed under the workspace, archived memberships left out. */
const findActorProjectsInWorkspace = async (ctx: ActorContext, { workspaceId }: FindActorProjectsInWorkspaceOpts) => {
  const { db, actor } = ctx.var;
  // Workspaces group a user's project memberships; a service account has none.
  if (actor.kind !== 'user') return [];
  return db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .innerJoin(
      membershipsTable,
      and(
        eq(membershipsTable.channelType, 'project'),
        eq(membershipsTable.projectId, projectsTable.id),
        eq(membershipsTable.workspaceId, workspaceId),
        eq(membershipsTable.userId, actor.id),
        eq(membershipsTable.archived, false),
      ),
    )
    .where(requestScopeWhere(ctx, projectsTable, 'project'));
};

interface FindProjectByIdOpts {
  projectId: string;
}

const findProjectById = async (ctx: ActorContext, { projectId }: FindProjectByIdOpts) => {
  const { db } = ctx.var;
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), requestScopeWhere(ctx, projectsTable)))
    .limit(1);
  return project;
};

/** Ids of every project in the request's organization. */
export const findOrganizationProjectIds = async (ctx: ActorContext): Promise<string[]> => {
  const { db } = ctx.var;
  const rows = await db.select({ id: projectsTable.id }).from(projectsTable).where(requestScopeWhere(ctx, projectsTable));
  return rows.map(({ id }) => id);
};

/** The project-homed list narrowing a product read asked for: `?projectId` must exist, `?workspaceId` spans its projects. */
export type ProjectNarrowing = { homeChannelId?: string; homeChannelIds?: string[] };

/**
 * Resolves `?projectId` / `?workspaceId` of a project-homed product list into the narrowing that
 * `resolveCollectionReadFilter` intersects with the caller's read scope.
 */
export const resolveProjectNarrowing = async (
  ctx: ActorContext,
  { projectId, workspaceId }: { projectId?: string; workspaceId?: string },
): Promise<ProjectNarrowing | undefined> => {
  if (projectId) {
    const project = await findProjectById(ctx, { projectId });
    if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });
    return { homeChannelId: projectId };
  }
  if (workspaceId) {
    const workspaceProjects = await findActorProjectsInWorkspace(ctx, { workspaceId });
    return { homeChannelIds: workspaceProjects.map(({ id }) => id) };
  }
  return undefined;
};

interface FindProjectsPaginatedOpts {
  userId: string;
  /** Lists the projects of archived tenants too. */
  isSystemAdmin: boolean;
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  /** Limits the list to these organizations: the ones the caller shares with another user whose projects are listed. */
  organizationIds?: string[];
  workspaceId?: string;
  excludeArchived?: boolean;
  role?: EntityRole;
  /** Lists every project this scope reads, with or without a membership of `userId`; without it only that user's own projects. */
  readScope?: ChannelCollectionReadScope;
  includeCounts: boolean;
}

/** Get paginated list of projects with total count, membership, optional entity counts. */
export const findProjectsPaginated = async (ctx: DbContext, opts: FindProjectsPaginatedOpts) => {
  const { db } = ctx.var;
  const {
    userId,
    isSystemAdmin,
    q,
    sort,
    order,
    offset,
    limit,
    organizationId,
    organizationIds,
    workspaceId,
    excludeArchived,
    role,
    readScope,
    includeCounts,
  } = opts;

  const entityType = 'project';

  const membershipKeyOn = and(
    eq(membershipsTable.projectId, projectsTable.id),
    eq(membershipsTable.userId, userId),
    eq(membershipsTable.channelType, entityType),
  );

  // In JOIN ON: under a read scope's LEFT JOIN they decide only whether the membership row is present.
  const membershipFilterOn = and(
    ...(excludeArchived ? [eq(membershipsTable.archived, false)] : []),
    ...(role ? [eq(membershipsTable.role, role)] : []),
  );

  const membershipOn = and(membershipKeyOn, membershipFilterOn);

  // An archived tenant's projects list for system admins only, as its organization does
  const projectWhere: SQL[] = [
    ...(isSystemAdmin
      ? []
      : [
          sql`NOT EXISTS (SELECT 1 FROM ${tenantsTable} WHERE ${tenantsTable.id} = ${projectsTable.tenantId} AND ${tenantsTable.status} = 'archived')`,
        ]),
    ...(q ? [textSearchFilter(projectsTable.name, q)] : []),
    ...(organizationId ? [eq(projectsTable.organizationId, organizationId)] : []),
    ...(organizationIds ? [inArray(projectsTable.organizationId, organizationIds)] : []),
    ...(workspaceId ? [eq(membershipsTable.workspaceId, workspaceId)] : []),
  ];

  // A read scope LEFT JOINs the membership, so readable projects without one are listed next to the user's own.
  if (readScope) {
    const readWhere = buildChannelListReadWhere(readScope, {
      membershipUserId: membershipsTable.userId,
      publishedAt: projectsTable.publishedAt,
      ancestorIdColumns: {},
    });
    if (readWhere.kind === 'where') projectWhere.push(readWhere.where);
  }

  const baseSelect = db.select({ projectId: projectsTable.id }).from(projectsTable);
  const baseQuery = (readScope ? baseSelect.leftJoin(membershipsTable, membershipOn) : baseSelect.innerJoin(membershipsTable, membershipOn)).where(
    and(...projectWhere),
  );

  const orderBy = getOrderColumns({
    sort,
    order,
    fallback: ['displayOrder', 'asc'],
    columns: { id: projectsTable.id, name: projectsTable.name, createdAt: projectsTable.createdAt, displayOrder: membershipsTable.displayOrder },
    tieBreaker: projectsTable.id,
  });

  const countData = includeCounts ? getChannelCountsSelect(entityType) : null;

  // Writer ids stay ids here; the operation resolves them to references for the page (`withActorRefs`).
  const selectShape = {
    ...getColumns(projectsTable),
    membership: membershipBaseSelect,
    ...(countData && { counts: countData.countsSelect }),
  } as const;

  const itemsSelect = db.select(selectShape).from(projectsTable);
  let query = readScope
    ? itemsSelect.leftJoin(membershipsTable, membershipOn).$dynamic()
    : itemsSelect.innerJoin(membershipsTable, membershipOn).$dynamic();

  if (countData) {
    query = query.leftJoin(channelCountersTable, sql`${projectsTable.id}::text = ${channelCountersTable.channelKey}`) as typeof query;
  }

  const itemsQuery = query
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
