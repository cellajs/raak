import { and, arrayOverlaps, asc, desc, eq, inArray, or, type SQL, sql } from 'drizzle-orm';
import { foldText, parseTerms } from 'shared/utils/text-match';
import type { z } from 'zod';
import type { ActorContext } from '#/core/context';
import { requestScopeWhere } from '#/db/utils/request-scope';
import { hydrateTasks } from '#/modules/task/operations/hydrate-task';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { findLabelsByProjects, findProjectMembers, findTasksPaginated } from '#/modules/task/task-queries';
import { taskListQueryBaseSchema } from '#/modules/task/task-schema';
import { isoDateAgo } from '#/utils/iso-date';
import { getOrderColumns } from '#/utils/order-column';
import { pick } from '#/utils/pick';
import { type SeqRange, seqRangeRead } from '#/utils/seq-range';
import { textSearchFilter } from '#/utils/sql';
import { TimeSpan } from '#/utils/time-span';

const queryInfoSchema = taskListQueryBaseSchema.omit({ projectId: true, workspaceId: true });
type QueryInfo = z.infer<typeof queryInfoSchema>;

/** A page of the tasks in `projectIds` that match the list query, hydrated with their projects' members and labels. */
export const listTasks = async (ctx: ActorContext, projectIds: string[], queryInfo: QueryInfo, opts?: { publicOnly?: boolean; range?: SeqRange }) => {
  const { q, sort, order, acceptedCutOff, limit, offset } = queryInfo;
  const rangeRead = seqRangeRead(tasksTable, opts?.range);

  const [tasksUsers, tasksLabels] = await Promise.all([findProjectMembers(ctx, { projectIds }), findLabelsByProjects(ctx, { projectIds })]);

  const keywordFilters = parseTerms(q).map((word) => {
    const wordFilters: SQL[] = [textSearchFilter(tasksTable.keywords, word)];

    const filteredLabels = tasksLabels.filter(({ name }) => foldText(name).includes(word)).map(({ id }) => id);
    if (filteredLabels.length > 0) wordFilters.push(arrayOverlaps(tasksTable.labels, filteredLabels));

    const filteredUsers = tasksUsers.filter(({ name }) => foldText(name).includes(word)).map(({ id }) => id);
    if (filteredUsers.length > 0) wordFilters.push(arrayOverlaps(tasksTable.assignedTo, filteredUsers));

    return or(...wordFilters);
  });

  const orderBy =
    rangeRead.orderBy ??
    getOrderColumns({
      sort,
      order,
      fallback: ['createdAt', 'asc'],
      columns: pick(tasksTable, ['status', 'projectId', 'createdAt', 'createdBy', 'updatedAt']),
      append: [desc(sql`COALESCE(${tasksTable.displayOrder}, 0)`.mapWith(Number)), asc(tasksTable.id)],
    });

  const acceptedCutOffFilter = acceptedCutOff
    ? sql`NOT (${tasksTable.status} = ${TaskStatus.Accepted} AND ${tasksTable.statusChangedAt} <= ${isoDateAgo(new TimeSpan(acceptedCutOff, 'd'))})`
    : undefined;

  const filters = and(
    ...rangeRead.where,
    ...keywordFilters,
    requestScopeWhere(ctx, tasksTable, 'task'),
    inArray(tasksTable.projectId, projectIds),
    acceptedCutOffFilter,
    opts?.publicOnly ? eq(tasksTable.public, true) : undefined,
  );

  const { items: tasks, total } = await findTasksPaginated(ctx, { filters, orderBy, limit, offset, isDelta: !!opts?.range });

  const items = await hydrateTasks(ctx, tasks, tasksUsers, tasksLabels);

  return { items, total };
};
