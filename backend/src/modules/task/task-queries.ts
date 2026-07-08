import { and, asc, count, eq, getColumns, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type { AuthContext, DbContext } from '#/core/context';
import { labelsTable } from '#/modules/label/label-db';
import { labelEmbeddedSelect } from '#/modules/label/label-schema';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { type InsertTaskModel, tasksTable } from '#/modules/task/task-db';
import { userMinimalBaseSelect } from '#/modules/user/helpers/select';
import { usersTable } from '#/modules/user/user-db';

interface FindTasksByStxMutationIdOpts {
  mutationId: string;
}

/** Find tasks by their STX mutation ID (idempotency check). */
export const findTasksByStxMutationId = async (ctx: AuthContext, { mutationId }: FindTasksByStxMutationIdOpts) => {
  const { db, organizationId } = ctx.var;
  return db
    .select()
    .from(tasksTable)
    .where(and(sql`${tasksTable.stx}->>'mutationId' = ${mutationId}`, eq(tasksTable.organizationId, organizationId)));
};

/** Insert tasks and return the created rows. Silently skips duplicates (PK conflict). */
export const insertTasks = async (ctx: DbContext, { tasks }: { tasks: InsertTaskModel[] }) => {
  const { db } = ctx.var;
  return db.insert(tasksTable).values(tasks).onConflictDoNothing().returning();
};

interface UpdateTaskOpts {
  id: string;
  values: Partial<InsertTaskModel>;
}

/** Update a task by ID and return the updated row. */
export const updateTask = async (ctx: AuthContext, { id, values }: UpdateTaskOpts) => {
  const { db, organizationId } = ctx.var;
  const [updated] = await db
    .update(tasksTable)
    .set(values)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.organizationId, organizationId)))
    .returning();
  return updated;
};

interface DeleteTasksByIdsOpts {
  ids: string[];
  deletedBy: string;
  deletedAt: string;
}

/** Soft-delete tasks by IDs and return the affected rows. */
export const deleteTasksByIds = async (ctx: AuthContext, { ids, deletedAt, deletedBy }: DeleteTasksByIdsOpts) => {
  const { db, organizationId } = ctx.var;
  return db
    .update(tasksTable)
    .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
    .where(
      and(inArray(tasksTable.id, ids), eq(tasksTable.organizationId, organizationId), isNull(tasksTable.deletedAt)),
    )
    .returning();
};

interface FindProjectsByWorkspaceOpts {
  workspaceId: string;
}

/** Find projects accessible via a workspace for a given user. */
export const findProjectsByWorkspace = async (ctx: AuthContext, { workspaceId }: FindProjectsByWorkspaceOpts) => {
  const { db, organizationId, userId } = ctx.var;
  return db
    .select({
      ...getColumns(projectsTable),
    })
    .from(projectsTable)
    .innerJoin(
      membershipsTable,
      and(
        eq(membershipsTable.contextType, 'project'),
        eq(membershipsTable.projectId, projectsTable.id),
        eq(membershipsTable.workspaceId, workspaceId),
        eq(membershipsTable.userId, userId),
        eq(membershipsTable.archived, false),
      ),
    )
    .where(eq(projectsTable.organizationId, organizationId));
};

interface FindProjectByIdOpts {
  projectId: string;
}

/** Find a single project by ID. */
export const findProjectById = async (ctx: AuthContext, { projectId }: FindProjectByIdOpts) => {
  const { db, organizationId } = ctx.var;
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.organizationId, organizationId)))
    .limit(1);
  return project;
};

interface FindProjectMemberUserIdsOpts {
  projectId: string;
  userIds: string[];
}

/** Find project members whose user IDs are in the given list (used for move-to-project). */
export const findProjectMemberUserIds = async (
  ctx: AuthContext,
  { projectId, userIds }: FindProjectMemberUserIdsOpts,
) => {
  const { db, organizationId } = ctx.var;
  return db
    .select({ userId: membershipsTable.userId })
    .from(membershipsTable)
    .where(
      and(
        inArray(membershipsTable.userId, userIds),
        eq(membershipsTable.contextType, 'project'),
        eq(membershipsTable.projectId, projectId),
        eq(membershipsTable.organizationId, organizationId),
      ),
    );
};

interface FindProjectMembersOpts {
  projectIds: string[];
}

/** Find distinct project members (users) for one or more projects in an organization. */
export const findProjectMembers = async (ctx: AuthContext, { projectIds }: FindProjectMembersOpts) => {
  const { db, organizationId } = ctx.var;
  return db
    .selectDistinct({ ...userMinimalBaseSelect, entityType: sql<'user'>`'user'` })
    .from(usersTable)
    .innerJoin(
      membershipsTable,
      and(eq(membershipsTable.organizationId, organizationId), inArray(membershipsTable.projectId, projectIds)),
    )
    .where(eq(usersTable.id, membershipsTable.userId))
    .orderBy(asc(usersTable.name));
};

interface FindLabelsByProjectsOpts {
  projectIds: string[];
}

/** Find distinct labels for one or more projects in an organization. */
export const findLabelsByProjects = async (ctx: AuthContext, { projectIds }: FindLabelsByProjectsOpts) => {
  const { db, organizationId } = ctx.var;
  return db
    .selectDistinct(labelEmbeddedSelect)
    .from(labelsTable)
    .where(and(eq(labelsTable.organizationId, organizationId), inArray(labelsTable.projectId, projectIds)))
    .orderBy(asc(labelsTable.name));
};

interface FindTaskRelationsOpts {
  userIds: string[];
  labelIds: string[];
}

/** Fetch users and labels referenced by one or more tasks (by ID lookups). */
export const findTaskRelations = (ctx: AuthContext, { userIds, labelIds }: FindTaskRelationsOpts) => {
  const { db, organizationId } = ctx.var;
  return Promise.all([
    userIds.length > 0
      ? db
          .select({ ...userMinimalBaseSelect, entityType: sql<'user'>`'user'` })
          .from(usersTable)
          .where(inArray(usersTable.id, userIds))
      : [],
    labelIds.length > 0
      ? db
          .select(labelEmbeddedSelect)
          .from(labelsTable)
          .where(and(inArray(labelsTable.id, labelIds), eq(labelsTable.organizationId, organizationId)))
          .orderBy(asc(labelsTable.name))
      : [],
  ]);
};

interface FindTasksPaginatedOpts {
  filters: SQL | undefined;
  orderBy: SQL[];
  limit: number;
  offset: number;
}

/** Fetch paginated tasks with count in parallel. */
export const findTasksPaginated = async (
  ctx: DbContext,
  { filters, orderBy, limit, offset }: FindTasksPaginatedOpts,
) => {
  const { db } = ctx.var;
  return Promise.all([
    db
      .select()
      .from(tasksTable)
      .where(filters)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(tasksTable).where(filters),
  ]);
};

/** Count tasks grouped by status for a single project. */
export const countTasksByStatus = async (ctx: DbContext, projectId: string) => {
  const { db } = ctx.var;
  return db
    .select({
      status: tasksTable.status,
      count: count(),
    })
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId))
    .groupBy(tasksTable.status);
};
