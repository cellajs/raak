import { useQueries } from '@tanstack/react-query';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { tasksCanonicalOptions } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';

/** Label id → how many tasks carry it. */
export type LabelUsage = Record<string, number>;

// Module-scoped so its identity is stable; react-query then structurally shares the result.
const countLabelUsage = (results: { data?: { items: Pick<Task, 'labels'>[] } }[]): LabelUsage => {
  const usage: LabelUsage = {};
  for (const result of results) {
    for (const task of result.data?.items ?? []) {
      for (const label of task.labels) usage[label.id] = (usage[label.id] ?? 0) + 1;
    }
  }
  return usage;
};

/**
 * Label usage counted over the projects' synced board task lists, so it follows every task change without a refetch.
 * Reads the cache only: the board route loads these lists, and a project it has not loaded counts as unused.
 */
export const useLabelUsage = (projectIds: string[]): LabelUsage => {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  return useQueries({
    queries: projectIds.map((projectId) => ({ ...tasksCanonicalOptions({ organizationId, tenantId, projectId }), enabled: false })),
    combine: countLabelUsage,
  });
};
