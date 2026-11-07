import { useQueries } from '@tanstack/react-query';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { type EpicProgress, epicPartOf, noEpicProgress } from '~/modules/label/epic-progress';
import { labelOlderAcceptedCountsOptions } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { boardSearchParts, type ParsedBoardSearch } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { useTaskListsSnapshot } from '~/modules/task/hooks/use-task-lists-snapshot';
import { olderAcceptedListKey, taskKeys, tasksCanonicalOptions } from '~/modules/task/query';
import { boardAcceptedCutOffDays, TaskStatus } from '~/modules/task/task-properties';
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
  // A search of labels and Accepted also lists those labels' older accepted tasks, so they count as well
  const countsOlder = search.labels.length > 0 && search.statuses.includes('accepted');
  const counted = useTaskListsSnapshot(
    projectIds.flatMap((projectId) => [
      taskKeys.list.home(organizationId, projectId),
      ...(countsOlder ? [olderAcceptedListKey(organizationId, projectId, search.labels)] : []),
    ]),
    JSON.stringify(search),
    (tasks) => JSON.stringify(countBoardLabelUsage(tasks, search)),
  );
  return JSON.parse(counted);
};

/** Epic row id → its progress over the cached board lists, whatever the board search; `rowOfLabel` maps each epic label to its row. */
const countEpicProgress = (tasks: Task[], rowOfLabel: Record<string, string>): Record<string, EpicProgress> => {
  const progress: Record<string, EpicProgress> = {};
  for (const task of tasks) {
    const part = isDraftTask(task) ? null : epicPartOf(task.status);
    if (!part) continue;
    // A task counts once per epic, though it could carry two of its labels
    const rowIds = new Set(task.labels.map(({ id }) => rowOfLabel[id]).filter(Boolean));
    for (const rowId of rowIds) {
      const counts = progress[rowId] ?? { ...noEpicProgress };
      counts[part] += 1;
      progress[rowId] = counts;
    }
  }
  return progress;
};

// Module-scoped so its identity is stable: useQueries recombines whenever the function changes
const combineOlderAccepted = (results: { data?: Record<string, number> }[]): Record<string, number> =>
  Object.assign({}, ...results.map((result) => result.data ?? {}));

/**
 * Epic row id → how far along it is: one walk of the cached board lists for every epic on the list, plus the server's count of tasks
 * accepted before the board's cut-off, which the lists leave out.
 */
export const useEpicProgress = (rows: LabelRow[]): Record<string, EpicProgress> => {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const epics = rows.filter(({ mode }) => mode === 'epic');
  const rowOfLabel: Record<string, string> = Object.fromEntries(epics.flatMap((row) => row.siblingIds.map((id) => [id, row.id])));
  const projectIds = [...new Set(epics.flatMap((row) => row.projectIds))];

  const listed = useTaskListsSnapshot(
    projectIds.map((projectId) => taskKeys.list.home(organizationId, projectId)),
    epics.length ? JSON.stringify(rowOfLabel) : null,
    (tasks) => JSON.stringify(countEpicProgress(tasks, rowOfLabel)),
  );
  const olderAccepted = useQueries({
    queries: projectIds.map((projectId) =>
      labelOlderAcceptedCountsOptions({ organizationId, tenantId, projectId, acceptedCutOff: boardAcceptedCutOffDays }),
    ),
    combine: combineOlderAccepted,
  });

  const progress: Record<string, EpicProgress> = listed ? JSON.parse(listed) : {};
  return Object.fromEntries(
    epics.map((row) => {
      const counts = progress[row.id] ?? noEpicProgress;
      const older = row.siblingIds.reduce((sum, id) => sum + (olderAccepted[id] ?? 0), 0);
      return [row.id, { ...counts, done: counts.done + older }];
    }),
  );
};
