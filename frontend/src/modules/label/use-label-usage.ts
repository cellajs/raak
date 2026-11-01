import { useQueries } from '@tanstack/react-query';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { labelOlderAcceptedCountsOptions } from '~/modules/label/query';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { boardAcceptedCutOffDays, TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

/** Label id → how many tasks not yet accepted carry it. */
export type LabelUsage = Record<string, number>;

/** Label id → how many tasks carry it, accepted or not. */
export type LabelTotals = Record<string, number>;

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

// A cached list can outlive the cut-off. A task past it counts on the server's side only, or it would count twice.
const countListedLabelTotals = (results: { data?: { items: Pick<Task, 'labels' | 'status' | 'statusChangedAt'>[] } }[]): LabelTotals => {
  const acceptedBefore = new Date(Date.now() - boardAcceptedCutOffDays * 24 * 60 * 60 * 1000).toISOString();
  const totals: LabelTotals = {};
  for (const result of results) {
    for (const task of result.data?.items ?? []) {
      if (task.status === TaskStatus.Accepted && task.statusChangedAt <= acceptedBefore) continue;
      for (const label of task.labels) totals[label.id] = (totals[label.id] ?? 0) + 1;
    }
  }
  return totals;
};

const sumOlderAcceptedCounts = (results: { data?: LabelTotals }[]): LabelTotals => {
  const totals: LabelTotals = {};
  for (const result of results) {
    for (const [labelId, count] of Object.entries(result.data ?? {})) totals[labelId] = (totals[labelId] ?? 0) + count;
  }
  return totals;
};

/**
 * Label totals: the cached board lists, which follow every edit, plus the server's count of tasks accepted before the cut-off,
 * which those lists leave out. A total fetched whole would lag the live usage count beside it, and could read "4 / 3".
 */
export const useLabelTotals = (projectIds: string[]): LabelTotals => {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const listed = useQueries({
    queries: projectIds.map((projectId) => ({ ...tasksCanonicalOptions({ organizationId, tenantId, projectId }), enabled: false })),
    combine: countListedLabelTotals,
  });
  const older = useQueries({
    queries: projectIds.map((projectId) => labelOlderAcceptedCountsOptions({ organizationId, tenantId, projectId })),
    combine: sumOlderAcceptedCounts,
  });

  const totals = { ...listed };
  for (const [labelId, count] of Object.entries(older)) totals[labelId] = (totals[labelId] ?? 0) + count;
  return totals;
};
