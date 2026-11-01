import { and, asc, count, eq, inArray, isNull, lte, type SQL, sql } from 'drizzle-orm';
import type { ActorContext, DbContext } from '#/core/context';
import type { DbOrTx } from '#/db/db';
import type { ActorId } from '#/db/utils/ids';
import { type ListTotalSource, resolveListTotal } from '#/db/utils/list-total';
import { requestScope, requestScopeWhere } from '#/db/utils/request-scope';
import { deleteStamps, updateStamps } from '#/db/utils/stamps';
import { stripChangedFields } from '#/db/utils/strip-changed-fields';
import { labelsTable } from '#/modules/label/label-db';
import { labelEmbeddedSelect } from '#/modules/label/label-schema';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { type InsertTaskModel, tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { userMinimalBaseSelect } from '#/modules/user/helpers/select';
import { usersTable } from '#/modules/user/user-db';
import type { StxBase } from '#/schemas/sync-transaction-schemas';

interface InsertTasksOpts {
  tasks: InsertTaskModel[];
}

/** Insert tasks and return the created rows. Silently skips duplicates (PK conflict). */
export const insertTasks = async (ctx: DbContext, { tasks }: InsertTasksOpts) => {
  const { db } = ctx.var;
  return db.insert(tasksTable).values(tasks).onConflictDoNothing().returning();
};

interface UpdateTaskOpts {
  id: string;
  values: Partial<InsertTaskModel>;
}

/** Update a task by ID and return the updated row. */
export const updateTask = async (ctx: ActorContext, { id, values }: UpdateTaskOpts) => {
  const { db } = ctx.var;
  const [updated] = await db
    .update(tasksTable)
    .set(values)
    .where(and(eq(tasksTable.id, id), requestScopeWhere(ctx, tasksTable, 'task')))
    .returning();
  return updated;
};

interface DeleteTasksByIdsOpts {
  ids: string[];
  /** Who deletes: stamped as the tombstone and as the row's last write. */
  actorId: ActorId;
  stx: Pick<StxBase, 'mutationId' | 'sourceId'>;
}

/** Soft-delete tasks by IDs and return the affected rows. */
export const deleteTasksByIds = async (ctx: ActorContext, { ids, actorId, stx }: DeleteTasksByIdsOpts) => {
  const { db } = ctx.var;
  return db
    .update(tasksTable)
    .set({ ...deleteStamps(actorId), stx: stripChangedFields(tasksTable.stx, stx) })
    .where(and(inArray(tasksTable.id, ids), requestScopeWhere(ctx, tasksTable, 'task'), isNull(tasksTable.deletedAt)))
    .returning();
};

interface FindProjectMemberUserIdsOpts {
  projectIds: string[];
  userIds: string[];
}

/** The project memberships of `userIds` in `projectIds`, as user and project id pairs. */
export const findProjectMemberUserIds = async (ctx: ActorContext, { projectIds, userIds }: FindProjectMemberUserIdsOpts) => {
  if (userIds.length === 0) return [];
  const { db } = ctx.var;
  const { organizationId } = requestScope(ctx);
  return db
    .select({ userId: membershipsTable.userId, projectId: membershipsTable.projectId })
    .from(membershipsTable)
    .where(
      and(
        inArray(membershipsTable.userId, userIds),
        eq(membershipsTable.channelType, 'project'),
        inArray(membershipsTable.projectId, projectIds),
        eq(membershipsTable.organizationId, organizationId),
      ),
    );
};

interface FindProjectMembersOpts {
  projectIds: string[];
}

/** Find distinct project members (users) for one or more projects in an organization. */
export const findProjectMembers = async (ctx: ActorContext, { projectIds }: FindProjectMembersOpts) => {
  const { db } = ctx.var;
  const { organizationId } = requestScope(ctx);
  return db
    .selectDistinct({ ...userMinimalBaseSelect, entityType: sql<'user'>`'user'` })
    .from(usersTable)
    .innerJoin(membershipsTable, and(eq(membershipsTable.organizationId, organizationId), inArray(membershipsTable.projectId, projectIds)))
    .where(eq(usersTable.id, membershipsTable.userId))
    .orderBy(asc(usersTable.name));
};

interface FindLabelsByProjectsOpts {
  projectIds: string[];
}

/** Find distinct labels for one or more projects in an organization. */
export const findLabelsByProjects = async (ctx: ActorContext, { projectIds }: FindLabelsByProjectsOpts) => {
  const { db } = ctx.var;
  return db
    .selectDistinct(labelEmbeddedSelect)
    .from(labelsTable)
    .where(and(requestScopeWhere(ctx, labelsTable, 'label'), inArray(labelsTable.projectId, projectIds)))
    .orderBy(asc(labelsTable.name));
};

interface FindTaskRelationsOpts {
  userIds: string[];
  labelIds: string[];
}

/** Fetch users and labels referenced by one or more tasks (by ID lookups). */
export const findTaskRelations = async (ctx: ActorContext, { userIds, labelIds }: FindTaskRelationsOpts) => {
  const { db } = ctx.var;
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
          .where(and(inArray(labelsTable.id, labelIds), requestScopeWhere(ctx, labelsTable, 'label')))
          .orderBy(asc(labelsTable.name))
      : [],
  ]);
};

interface FindTasksPaginatedOpts {
  filters: SQL | undefined;
  orderBy: SQL[];
  limit: number;
  offset: number;
  isDelta: boolean;
}

/**
 * Fetch a paginated page of tasks and its `total`. Range reads discard `total`, so the
 * COUNT(*) is skipped entirely; tasks are always project-scoped and thus never org-wide
 * counter-eligible, so normal reads resolve `total` via the exact COUNT(*).
 */
export const findTasksPaginated = async (ctx: DbContext, { filters, orderBy, limit, offset, isDelta }: FindTasksPaginatedOpts) => {
  const { db } = ctx.var;
  const itemsQuery = db
    .select()
    .from(tasksTable)
    .where(filters)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const totalSource: ListTotalSource = isDelta
    ? { kind: 'pageLength' }
    : {
        kind: 'exact',
        getTotal: async () => {
          const [{ total }] = await db.select({ total: count() }).from(tasksTable).where(filters);
          return total;
        },
      };

  return resolveListTotal(itemsQuery, totalSource);
};

interface CountTasksByStatusOpts {
  projectId: string;
}

export const countTasksByStatus = async (ctx: ActorContext, { projectId }: CountTasksByStatusOpts) => {
  const { db } = ctx.var;
  return db
    .select({ status: tasksTable.status, count: count() })
    .from(tasksTable)
    .where(and(eq(tasksTable.projectId, projectId), requestScopeWhere(ctx, tasksTable, 'task')))
    .groupBy(tasksTable.status);
};

interface CountOlderAcceptedTasksByLabelOpts {
  projectIds: string[];
  acceptedBefore: string;
}

export const countOlderAcceptedTasksByLabel = async (ctx: ActorContext, { projectIds, acceptedBefore }: CountOlderAcceptedTasksByLabelOpts) => {
  const { db } = ctx.var;
  const labelId = sql<string>`unnest(${tasksTable.labels})`;
  return db
    .select({ labelId, count: count() })
    .from(tasksTable)
    .where(
      and(
        inArray(tasksTable.projectId, projectIds),
        requestScopeWhere(ctx, tasksTable, 'task'),
        eq(tasksTable.status, TaskStatus.Accepted),
        lte(tasksTable.statusChangedAt, acceptedBefore),
        isNull(tasksTable.deletedAt),
      ),
    )
    .groupBy(labelId);
};

/**
 * Reassign tasks referencing soft-deleted primary labels to their project's default
 * (first remaining live primary by displayOrder). Runs in the label delete transaction
 * because tasks.primaryLabelId is NOT NULL; server-origin write.
 */
export const reassignTasksFromDeletedPrimaries = async (
  ctx: ActorContext,
  { deletedPrimaryIds, updatedBy }: { deletedPrimaryIds: string[]; updatedBy: ActorId },
): Promise<void> => {
  if (deletedPrimaryIds.length === 0) return;
  const { db } = ctx.var;
  await db
    .update(tasksTable)
    .set({
      primaryLabelId: sql`(
        SELECT l.id FROM labels l
        WHERE l.project_id = ${tasksTable.projectId}
          AND l.mode = 'primary'
          AND l.deleted_at IS NULL
        ORDER BY l.display_order ASC NULLS LAST
        LIMIT 1
      )`,
      ...updateStamps(updatedBy),
      stx: stripChangedFields(tasksTable.stx),
    })
    .where(and(inArray(tasksTable.primaryLabelId, deletedPrimaryIds), requestScopeWhere(ctx, tasksTable, 'task')));
};

const liveTasks = (ids: string[]) => and(inArray(tasksTable.id, ids), isNull(tasksTable.deletedAt));

/** A live task's title columns and body, for an instant notification email. */
export const findTaskNotificationPreview = async (tx: DbOrTx, id: string) => {
  const [row] = await tx
    .select({ name: tasksTable.name, summary: tasksTable.summary, description: tasksTable.description })
    .from(tasksTable)
    .where(liveTasks([id]))
    .limit(1);
  return row;
};

/** Live tasks' title columns, for notification lists and digests. */
export const findTaskNotificationTitles = (tx: DbOrTx, ids: string[]) =>
  tx.select({ id: tasksTable.id, name: tasksTable.name, summary: tasksTable.summary }).from(tasksTable).where(liveTasks(ids));

/** A live task by id with no request scope, for link resolution outside a tenant; undefined when absent or deleted. */
export const findLiveTaskById = async (ctx: DbContext, { id }: { id: string }) => {
  const [task] = await ctx.var.db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), isNull(tasksTable.deletedAt)))
    .limit(1);
  return task;
};

/** Where a task's project lives, with no request scope. */
export const findTaskLinkTarget = async (ctx: DbContext, { projectId }: { projectId: string }) => {
  const [target] = await ctx.var.db
    .select({
      name: projectsTable.name,
      slug: projectsTable.slug,
      organizationId: projectsTable.organizationId,
      tenantId: projectsTable.tenantId,
      public: projectsTable.public,
      organizationSlug: organizationsTable.slug,
    })
    .from(projectsTable)
    .innerJoin(organizationsTable, eq(organizationsTable.id, projectsTable.organizationId))
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  return target;
};
