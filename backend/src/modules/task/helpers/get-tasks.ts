import { and, arrayOverlaps, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { AuthContext } from '#/core/context';
import { hydrateTasks } from '#/modules/task/helpers/hydrate-task';
import { getDateFromToday } from '#/modules/task/helpers/utils';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { findLabelsByProjects, findProjectMembers, findTasksPaginated } from '#/modules/task/task-queries';
import { taskListQueryBaseSchema } from '#/modules/task/task-schema';
import { getOrderColumn } from '#/utils/order-column';
import { seqCursorFilters } from '#/utils/seq-cursor';

const queryInfoSchema = taskListQueryBaseSchema.omit({ projectId: true, workspaceId: true });
type QueryInfo = z.infer<typeof queryInfoSchema>;

/**
 * Get list of tasks for a project, with filtering, sorting, and pagination.
 */
export const getTasks = async (ctx: AuthContext, projectIds: string[], queryInfo: QueryInfo) => {
  const { q, sort, order, acceptedCutOff, matchMode, limit, offset, seqCursor } = queryInfo;
  const trimmedQuery = q?.trim();

  // Get users and labels data in parallel
  const [tasksUsers, tasksLabels] = await Promise.all([
    findProjectMembers(ctx, { projectIds }),
    findLabelsByProjects(ctx, { projectIds }),
  ]);

  // Build search filters
  const tasksSearchFilters: SQL[] = [];
  tasksSearchFilters.push(...seqCursorFilters(tasksTable.seq, seqCursor));

  if (trimmedQuery) {
    const searchKeywords = trimmedQuery.split(/\s+/).filter(Boolean);

    if (searchKeywords.length > 0) {
      const filterFn = (item: string) =>
        matchMode === 'all' ? item.includes(trimmedQuery) : searchKeywords.some((w) => item.includes(w));

      const filteredLabels = tasksLabels.filter(({ name }) => filterFn(name)).map(({ id }) => id);
      if (filteredLabels.length > 0) tasksSearchFilters.push(arrayOverlaps(tasksTable.labels, filteredLabels));

      const filteredUsers = tasksUsers.filter(({ name }) => filterFn(name)).map(({ id }) => id);
      if (filteredUsers.length > 0) tasksSearchFilters.push(arrayOverlaps(tasksTable.assignedTo, filteredUsers));

      if (matchMode === 'all') {
        tasksSearchFilters.push(ilike(tasksTable.description, `%${trimmedQuery}%`));
      } else {
        for (const word of searchKeywords) tasksSearchFilters.push(ilike(tasksTable.keywords, `%${word}%`));
      }
    }
  }

  // Sorting
  const orderColumn = getOrderColumn(sort, tasksTable.status, order, {
    variant: tasksTable.variant,
    status: tasksTable.status,
    projectId: tasksTable.projectId,
    createdAt: tasksTable.createdAt,
    createdBy: tasksTable.createdBy,
    updatedAt: tasksTable.updatedAt,
  });

  // Exclude accepted tasks older than cutoff directly in WHERE (avoids separate query + notInArray)
  const acceptedCutOffFilter = acceptedCutOff
    ? sql`NOT (${tasksTable.status} = ${TaskStatus.Accepted} AND coalesce(${tasksTable.updatedAt}, ${tasksTable.createdAt}) <= ${getDateFromToday(acceptedCutOff)})`
    : undefined;

  // Shared WHERE filters
  const filters = and(
    or(...tasksSearchFilters),
    eq(tasksTable.organizationId, ctx.var.organizationId),
    inArray(tasksTable.projectId, projectIds),
    acceptedCutOffFilter,
    // Hide tombstones for normal reads; on seqCursor delta sync they flow through so caches can drop them
    seqCursor ? undefined : isNull(tasksTable.deletedAt),
  );

  // Parallel count + data fetch
  const [tasks, [{ total }]] = await findTasksPaginated(ctx, { filters, orderColumn, limit, offset });

  const items = hydrateTasks(tasks, tasksUsers, tasksLabels);

  return { items, total };
};
