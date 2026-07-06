import { and, arrayOverlaps, asc, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
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
  const { q, sort, order, acceptedCutOff, matchMode, limit, offset, seqCursor, includeDeleted } = queryInfo;
  const trimmedQuery = q?.trim();

  // Get users and labels data in parallel
  const [tasksUsers, tasksLabels] = await Promise.all([
    findProjectMembers(ctx, { projectIds }),
    findLabelsByProjects(ctx, { projectIds }),
  ]);

  // Build search filters
  const tasksSearchFilters: SQL[] = [];

  if (trimmedQuery) {
    const normalizedQuery = trimmedQuery.startsWith('=') ? trimmedQuery.slice(1).trim() : trimmedQuery;
    const searchKeywords = normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean);

    if (searchKeywords.length > 0) {
      const filtersByKeyword = searchKeywords.map((word) => {
        const wordFilters: SQL[] = [ilike(tasksTable.keywords, `%${word}%`)];

        const filteredLabels = tasksLabels.filter(({ name }) => name.toLowerCase().includes(word)).map(({ id }) => id);
        if (filteredLabels.length > 0) wordFilters.push(arrayOverlaps(tasksTable.labels, filteredLabels));

        const filteredUsers = tasksUsers.filter(({ name }) => name.toLowerCase().includes(word)).map(({ id }) => id);
        if (filteredUsers.length > 0) wordFilters.push(arrayOverlaps(tasksTable.assignedTo, filteredUsers));

        return or(...wordFilters);
      });

      const searchFilter = matchMode === 'all' ? and(...filtersByKeyword) : or(...filtersByKeyword);
      if (searchFilter) tasksSearchFilters.push(searchFilter);
    }
  }

  // Sorting. Seq reads (hydration + delta sync) are keyset-paged: seq order makes a
  // limit-capped page a clean prefix, so the client can resume from the last seq received.
  // Id tiebreak keeps ordering stable when per-context counters collide across projects.
  const orderColumn = seqCursor
    ? asc(tasksTable.seq)
    : getOrderColumn(sort, tasksTable.status, order, {
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

  // Shared WHERE filters. Seq range filters must be AND-combined — inside the OR'd search
  // group a bounded cursor ("51,150") would degenerate to `seq >= 51 OR seq <= 150` (= all rows).
  const filters = and(
    ...seqCursorFilters(tasksTable.seq, seqCursor),
    tasksSearchFilters.length ? or(...tasksSearchFilters) : undefined,
    eq(tasksTable.organizationId, ctx.var.organizationId),
    inArray(tasksTable.projectId, projectIds),
    acceptedCutOffFilter,
    // Hide tombstones unless a delta-sync read opts in via includeDeleted (with seqCursor);
    // they flow through there so client caches can drop soft-deleted rows.
    seqCursor && includeDeleted ? undefined : isNull(tasksTable.deletedAt),
  );

  // Parallel count + data fetch
  const orderBy = seqCursor
    ? [orderColumn, asc(tasksTable.id)]
    : [orderColumn, desc(sql`COALESCE(${tasksTable.displayOrder}, 0)`.mapWith(Number))];
  const [tasks, [{ total }]] = await findTasksPaginated(ctx, { filters, orderBy, limit, offset });

  const items = hydrateTasks(tasks, tasksUsers, tasksLabels);

  return { items, total };
};
