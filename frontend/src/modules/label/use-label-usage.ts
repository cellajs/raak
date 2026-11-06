import { useQueries } from '@tanstack/react-query';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import type { LabelRow } from '~/modules/label/types';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { boardSearchParts, type ParsedBoardSearch } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { useTaskListsSnapshot } from '~/modules/task/hooks/use-task-lists-snapshot';
import { taskKeys, tasksCanonicalOptions } from '~/modules/task/query';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

/** Label id → how many tasks not yet accepted carry it. */
export type LabelUsage = Record<string, number>;

// Module-scoped so its identity is stable; react-query then structurally shares the result.
const countLabelUsage = (results: { data?: { items: Pick<Task, 'labels' | 'status'>[] } }[]): LabelUsage => {
  const usage: LabelUsage = {};
  for (const result of results) {
    for (const task of result.data?.items ?? []) {
      if (task.status === TaskStatus.Accepted) continue;
      for (const label of task.labels) usage[label.id] = (usage[label.id] ?? 0) + 1;
    }
  }
  return usage;
};

/**
 * Label usage over the projects' cached board task lists (cache only: a project the board has not loaded counts as unused).
 * Accepted tasks are left out: the lists hold only those within `boardAcceptedCutOff`, so counting them would drift with time.
 */
export const useLabelUsage = (projectIds: string[]): LabelUsage => {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  return useQueries({
    queries: projectIds.map((projectId) => ({ ...tasksCanonicalOptions({ organizationId, tenantId, projectId }), enabled: false })),
    combine: countLabelUsage,
  });
};

// As in the search's own options, the label filter is left out: its values widen each other, so a count says what adding that label would show.
const countBoardLabelUsage = (tasks: Task[], search: ParsedBoardSearch): LabelUsage => {
  const usage: LabelUsage = {};
  const isAcceptedAsked = search.statuses.includes('accepted');
  for (const task of tasks) {
    if (isDraftTask(task) || (task.status === TaskStatus.Accepted && !isAcceptedAsked)) continue;
    const { words, status, type, assigned } = boardSearchParts(search, task);
    if (!words || !status || !type || !assigned) continue;
    for (const label of task.labels) usage[label.id] = (usage[label.id] ?? 0) + 1;
  }
  return usage;
};

/** The usage of `useLabelUsage` narrowed by the board search, for the board's labels list. Accepted tasks count only when the search asks for them. */
export const useBoardLabelUsage = (projectIds: string[]): LabelUsage => {
  const { organizationId } = useOrganizationLayoutContext();
  const search = useBoardSearch();
  const counted = useTaskListsSnapshot(
    projectIds.map((projectId) => taskKeys.list.home(organizationId, projectId)),
    JSON.stringify(search),
    (tasks) => JSON.stringify(countBoardLabelUsage(tasks, search)),
  );
  return JSON.parse(counted);
};

/** Project id → status → how many of its tasks carry the label. */
export type LabelStatusCounts = Record<string, Partial<Record<TaskStatus, number>>>;

// No server count of older accepted tasks: the bar shows Accepted only when the search asks, and then as many as the board lists hold
const countLabelStatuses = (tasks: Task[], labelIds: string[]): LabelStatusCounts => {
  const counts: LabelStatusCounts = {};
  for (const task of tasks) {
    if (isDraftTask(task) || !task.labels.some(({ id }) => labelIds.includes(id))) continue;
    const projectCounts = counts[task.projectId] ?? {};
    projectCounts[task.status] = (projectCounts[task.status] ?? 0) + 1;
    counts[task.projectId] = projectCounts;
  }
  return counts;
};

/** Tasks of a label group per project and status in the cached board lists, whatever the board search. Walks the lists, so only an open tile calls it. */
export const useLabelStatusCounts = ({ siblingIds, projectIds }: Pick<LabelRow, 'siblingIds' | 'projectIds'>): LabelStatusCounts => {
  const { organizationId } = useOrganizationLayoutContext();
  const listed = useTaskListsSnapshot(
    projectIds.map((projectId) => taskKeys.list.home(organizationId, projectId)),
    siblingIds.join(),
    (tasks) => JSON.stringify(countLabelStatuses(tasks, siblingIds)),
  );
  return JSON.parse(listed);
};
