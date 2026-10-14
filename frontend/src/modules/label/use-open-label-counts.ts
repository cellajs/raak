import { useQueries } from '@tanstack/react-query';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

type LabelCounts = Map<string, number>;

// Accepted tasks are excluded: the board loads only recent ones, so counting them would follow a time window, not the data.
const countOpenTaskLabels = (data: { items: Task[] }): LabelCounts => {
  const counts: LabelCounts = new Map();
  for (const task of data.items) {
    if (task.status === TaskStatus.Accepted) continue;
    for (const { id } of task.labels) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

// Module-scoped so useQueries keeps the combined value until a project's counts change.
const mergeCounts = (results: { data?: LabelCounts }[]): LabelCounts | undefined => {
  if (results.some((result) => !result.data)) return undefined;
  const merged: LabelCounts = new Map();
  for (const { data } of results) {
    for (const [id, count] of data ?? []) merged.set(id, (merged.get(id) ?? 0) + count);
  }
  return merged;
};

/** Open (not accepted) tasks per label id across the given projects, derived from their synced task lists. Undefined until every list has loaded. */
export function useOpenLabelCounts(projectIds: string[]): LabelCounts | undefined {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  return useQueries({
    queries: projectIds.map((projectId) => ({
      ...tasksCanonicalOptions({ organizationId, tenantId, projectId }),
      select: countOpenTaskLabels,
    })),
    combine: mergeCounts,
  });
}

/** Count of a label row, summed over its slug siblings in other projects. */
export const sumLabelCounts = (counts: LabelCounts | undefined, ids: string[]) =>
  counts ? ids.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0) : undefined;
