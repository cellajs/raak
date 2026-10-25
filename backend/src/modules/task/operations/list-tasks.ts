import { and, arrayOverlaps, asc, desc, eq, inArray, not, or, type SQL, sql } from 'drizzle-orm';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { foldText } from 'shared/utils/text-match';
import type { z } from 'zod';
import type { ActorContext } from '#/core/context';
import { publishedRowsPredicate } from '#/db/utils/published-predicate';
import { requestScopeWhere } from '#/db/utils/request-scope';
import { getDateFromToday } from '#/modules/task/helpers/utils';
import { hydrateTasks } from '#/modules/task/operations/hydrate-task';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { findLabelsByProjects, findProjectMembers, findTasksPaginated } from '#/modules/task/task-queries';
import { taskListQueryBaseSchema } from '#/modules/task/task-schema';
import { getOrderColumns } from '#/utils/order-column';
import { pick } from '#/utils/pick';
import { type SeqRange, seqRangeRead } from '#/utils/seq-range';
import { textSearchFilter } from '#/utils/sql';

const queryInfoSchema = taskListQueryBaseSchema.omit({ projectId: true, workspaceId: true });
type QueryInfo = z.infer<typeof queryInfoSchema>;

/**
 * Get list of tasks for a project, with filtering, sorting, and pagination.
 */
export const getTasks = async (ctx: ActorContext, projectIds: string[], queryInfo: QueryInfo, opts?: { publicOnly?: boolean; range?: SeqRange }) => {
  const { q, sort, order, acceptedCutOff, matchMode, excludeLabels, limit, offset } = queryInfo;
  const rangeRead = seqRangeRead(tasksTable, opts?.range);
  // Highlight-mode clients ('=' prefix) fetch unfiltered; stripping here keeps stray marked
  // queries behaving like their plain form.
  const { terms } = parseSearchQuery(q);

  // Get users and labels data in parallel
  const [tasksUsers, tasksLabels] = await Promise.all([findProjectMembers(ctx, { projectIds }), findLabelsByProjects(ctx, { projectIds })]);

  const tasksSearchFilters: SQL[] = [];

  if (terms.length > 0) {
    const filtersByKeyword = terms.map((word) => {
      const wordFilters: SQL[] = [textSearchFilter(tasksTable.keywords, word)];

      const filteredLabels = tasksLabels.filter(({ name }) => foldText(name).includes(word)).map(({ id }) => id);
      if (filteredLabels.length > 0) wordFilters.push(arrayOverlaps(tasksTable.labels, filteredLabels));

      const filteredUsers = tasksUsers.filter(({ name }) => foldText(name).includes(word)).map(({ id }) => id);
      if (filteredUsers.length > 0) wordFilters.push(arrayOverlaps(tasksTable.assignedTo, filteredUsers));

      return or(...wordFilters);
    });

    const searchFilter = matchMode === 'all' ? and(...filtersByKeyword) : or(...filtersByKeyword);
    if (searchFilter) tasksSearchFilters.push(searchFilter);
  }

  // A slug names the same label in every project, so it excludes each project's row of it
  const excludedLabelIds = excludeLabels?.length ? tasksLabels.filter(({ slug }) => excludeLabels.includes(slug)).map(({ id }) => id) : [];

  const orderBy =
    rangeRead.orderBy ??
    getOrderColumns({
      sort,
      order,
      fallback: ['createdAt', 'asc'],
      columns: pick(tasksTable, ['status', 'projectId', 'createdAt', 'createdBy', 'updatedAt']),
      append: [desc(sql`COALESCE(${tasksTable.displayOrder}, 0)`.mapWith(Number)), asc(tasksTable.id)],
    });

  // Exclude accepted tasks older than cutoff directly in WHERE (avoids separate query + notInArray)
  const acceptedCutOffFilter = acceptedCutOff
    ? sql`NOT (${tasksTable.status} = ${TaskStatus.Accepted} AND coalesce(${tasksTable.updatedAt}, ${tasksTable.createdAt}) <= ${getDateFromToday(acceptedCutOff)})`
    : undefined;

  const filters = and(
    ...rangeRead.where,
    tasksSearchFilters.length ? or(...tasksSearchFilters) : undefined,
    requestScopeWhere(ctx, tasksTable, 'task'),
    inArray(tasksTable.projectId, projectIds),
    acceptedCutOffFilter,
    excludedLabelIds.length ? not(arrayOverlaps(tasksTable.labels, excludedLabelIds)) : undefined,
    opts?.publicOnly ? and(eq(tasksTable.public, true), publishedRowsPredicate(tasksTable)) : undefined,
  );

  // Normal reads fetch the page and its exact COUNT(*) in parallel; range reads skip the count.
  const { items: tasks, total } = await findTasksPaginated(ctx, { filters, orderBy, limit, offset, isDelta: !!opts?.range });

  const items = await hydrateTasks(ctx, tasks, tasksUsers, tasksLabels);

  return { items, total };
};
