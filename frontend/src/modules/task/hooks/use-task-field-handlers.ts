import type { QueryKey, UseMutationResult } from '@tanstack/react-query';
import type { UserMinimalBase } from 'sdk';
import { getNewStatusTaskOrder } from '~/modules/task/helpers/order-helpers';
import { getItemsSortedByName } from '~/modules/task/helpers/sort-helpers';
import { taskKeys, useTaskUpdateMutation } from '~/modules/task/query';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task, TaskLabel, TaskPointsType, TaskStatusType, TaskVariantType } from '~/modules/task/types';
import { useUserStore } from '~/modules/user/user-store';
import { findInCache } from '~/query/basic';
import { cacheUpdate } from '~/query/basic/cache-mutations';
import { computeArrayDelta } from '~/query/offline';
import { queryClient } from '~/query/query-client';

export type TaskFieldHandlers = ReturnType<typeof buildFieldHandlers>;

interface FieldHandlerDeps {
  // biome-ignore lint/suspicious/noExplicitAny: mutation type varies by usage
  taskMutation: UseMutationResult<any, any, any, any>;
  orgKey: QueryKey;
  user: UserMinimalBase;
}

/**
 * Pure function that builds field-level onChange handlers for an existing task.
 * Can be called from hooks or plain functions alike.
 */
export function buildFieldHandlers(task: Task, deps: FieldHandlerDeps) {
  const { taskMutation, orgKey, user } = deps;

  const baseTaskInfo = { id: task.id };

  const onPointsChange = (newPoints: TaskPointsType) => {
    if (task.points === newPoints) return;
    taskMutation.mutate({
      ...baseTaskInfo,
      ops: { points: newPoints },
    });
  };

  // Track last-applied labels across calls so consecutive clicks in the same
  // dropdown session compute deltas against the previous selection, not the
  // dropdown-open snapshot. Avoids re-sending already-removed/added IDs.
  // findInCache is unsafe: squashed mutations' onSuccess can write stale arrays.
  let labelsBaseline: TaskLabel[] | null = null;
  const onLabelsChange = (updatedLabels: TaskLabel[]) => {
    const baseline = labelsBaseline ?? task.labels;
    const oldIds = baseline.map(({ id }) => id);
    const newIds = updatedLabels.map(({ id }) => id);
    const delta = computeArrayDelta(oldIds, newIds);
    labelsBaseline = updatedLabels;
    taskMutation.mutate({
      ...baseTaskInfo,
      ops: { labels: delta },
      fullLabels: updatedLabels,
    });
  };

  // Same baseline-tracking pattern as labels — see comment above.
  let assignedToBaseline: UserMinimalBase[] | null = null;
  const onAssignedToChange = (updatedUsers: UserMinimalBase[]) => {
    const baseline = assignedToBaseline ?? task.assignedTo;
    const oldIds = baseline.map(({ id }) => id);
    const newIds = updatedUsers.map(({ id }) => id);
    const delta = computeArrayDelta(oldIds, newIds);
    assignedToBaseline = updatedUsers;
    taskMutation.mutate({
      ...baseTaskInfo,
      ops: { assignedTo: delta },
      fullAssignedTo: updatedUsers,
    });
  };

  const onStatusChange = async (newStatus: TaskStatusType) => {
    if (task.status === newStatus) return;

    const newOrder = getNewStatusTaskOrder(task, newStatus);

    // Read current task from cache to avoid stale closure when called from dropdowner
    const currentTask = findInCache<Task>('task', task.id) ?? task;

    // Assign to self if the status is "started", but only if the user is not already assigned
    const sortedAssignedTo = getItemsSortedByName([...currentTask.assignedTo, user]);
    const shouldAssignToSelf =
      newStatus === TaskStatus.Started && !currentTask.assignedTo.find(({ id }) => id === user.id);

    // Pre-set optimistic state for both fields so UI updates instantly
    const optimisticTask: Task = {
      ...task,
      status: newStatus,
      ...(typeof newOrder === 'number' ? { displayOrder: newOrder } : {}),
      ...(shouldAssignToSelf ? { assignedTo: sortedAssignedTo } : {}),
      updatedAt: new Date().toISOString(),
    };
    cacheUpdate(orgKey, [optimisticTask]);
    queryClient.setQueryData<Task>(taskKeys.detail.byId(task.id), (old) => (old ? optimisticTask : old));

    // Combine status + assignedTo + displayOrder into a single mutation when both change
    const statusOps: Record<string, unknown> = { status: newStatus };
    if (typeof newOrder === 'number') statusOps.displayOrder = newOrder;
    if (shouldAssignToSelf) {
      const oldIds = currentTask.assignedTo.map(({ id }) => id);
      const newIds = sortedAssignedTo.map(({ id }) => id);
      statusOps.assignedTo = computeArrayDelta(oldIds, newIds);
    }

    await taskMutation.mutateAsync({
      ...baseTaskInfo,
      ops: statusOps,
      ...(shouldAssignToSelf ? { fullAssignedTo: sortedAssignedTo } : {}),
    });
  };

  const onVariantChange = (newVariant: TaskVariantType) => {
    if (task.variant === newVariant) return;
    taskMutation.mutate({
      ...baseTaskInfo,
      ops: { variant: newVariant },
    });
  };

  return {
    onPointsChange,
    onLabelsChange,
    onAssignedToChange,
    onStatusChange,
    onVariantChange,
  };
}

/**
 * Hook that returns field-level onChange handlers for an existing task.
 * Each handler wraps the task update mutation with optimistic updates.
 */
export const useTaskFieldHandlers = (task: Task) => {
  const { user } = useUserStore();
  const taskMutation = useTaskUpdateMutation(task.tenantId, task.organizationId);
  const orgKey = taskKeys.list.org(task.organizationId);

  return buildFieldHandlers(task, { taskMutation, orgKey, user });
};
