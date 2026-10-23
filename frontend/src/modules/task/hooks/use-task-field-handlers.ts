import type { UserMinimalBase } from 'sdk';
import { getNewStatusTaskOrder } from '~/modules/task/helpers/order-helpers';
import { getItemsSortedByName } from '~/modules/task/helpers/sort-helpers';
import { useTaskUpdateMutation } from '~/modules/task/query';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task, TaskStatusType } from '~/modules/task/types';
import { useCurrentUser } from '~/modules/user/user-store';
import { findInCache } from '~/query/basic/find-in-list-cache';
import { type ArrayDelta, computeArrayDelta } from '~/query/offline/array-delta';

interface FieldHandlerDeps {
  taskMutation: ReturnType<typeof useTaskUpdateMutation>;
  user: UserMinimalBase;
}

// Tracks the last-applied list across calls so consecutive clicks in the same dropdown session compute deltas
// against the previous selection, not the dropdown-open snapshot. Avoids re-sending already-removed/added IDs.
// findInCache is unsafe: squashed mutations' onSuccess can write stale arrays.
const trackedListHandler = <T extends { id: string }>(initial: T[], onChange: (delta: ArrayDelta, updated: T[]) => void) => {
  let baseline = initial;
  return (updated: T[]) => {
    const delta = computeArrayDelta(
      baseline.map(({ id }) => id),
      updated.map(({ id }) => id),
    );
    baseline = updated;
    onChange(delta, updated);
  };
};

/**
 * Pure function that builds field-level onChange handlers for an existing task.
 * Can be called from hooks or plain functions alike.
 */
export function buildFieldHandlers(task: Task, deps: FieldHandlerDeps) {
  const { taskMutation, user } = deps;

  const baseTaskInfo = { id: task.id };

  const onLabelsChange = trackedListHandler(task.labels, (delta, fullLabels) =>
    taskMutation.mutate({ ...baseTaskInfo, ops: { labels: delta }, fullLabels }),
  );
  const onAssignedToChange = trackedListHandler(task.assignedTo, (delta, fullAssignedTo) =>
    taskMutation.mutate({ ...baseTaskInfo, ops: { assignedTo: delta }, fullAssignedTo }),
  );

  const onStatusChange = async (newStatus: TaskStatusType, newOrder = getNewStatusTaskOrder(task, newStatus)) => {
    if (task.status === newStatus) return;

    // Read current task from cache to avoid stale closure when called from dropdowner
    const currentTask = findInCache<Task>('task', task.id) ?? task;

    // Assign to self if the status is "started", but only if the user is not already assigned
    const sortedAssignedTo = getItemsSortedByName([...currentTask.assignedTo, user]);
    const shouldAssignToSelf = newStatus === TaskStatus.Started && !currentTask.assignedTo.find(({ id }) => id === user.id);

    // Optimistic cache state comes from the mutation's onMutate (ops + fullAssignedTo)

    // Combine status + assignedTo + displayOrder into a single mutation when both change
    const statusOps: Record<string, unknown> = { status: newStatus, displayOrder: newOrder };
    if (shouldAssignToSelf) {
      const oldIds = currentTask.assignedTo.map(({ id }) => id);
      const newIds = sortedAssignedTo.map(({ id }) => id);
      statusOps.assignedTo = computeArrayDelta(oldIds, newIds);
    }

    await taskMutation.mutateAsync({ ...baseTaskInfo, ops: statusOps, ...(shouldAssignToSelf ? { fullAssignedTo: sortedAssignedTo } : {}) });
  };

  const onPrimaryLabelChange = (newPrimaryLabelId: string) => {
    if (task.primaryLabelId === newPrimaryLabelId) return;
    taskMutation.mutate({ ...baseTaskInfo, ops: { primaryLabelId: newPrimaryLabelId } });
  };

  return { onLabelsChange, onAssignedToChange, onStatusChange, onPrimaryLabelChange };
}

/**
 * Hook that returns field-level onChange handlers for an existing task.
 * Each handler wraps the task update mutation with optimistic updates.
 */
export const useTaskFieldHandlers = (task: Task) => {
  const user = useCurrentUser();
  const taskMutation = useTaskUpdateMutation(task.tenantId, task.organizationId);

  // Intentionally NOT memoized: the label/assignee baselines (see buildFieldHandlers) rely on fresh
  // handlers per render + the dropdowner capturing one instance per open session. Memoizing would
  // either never hold (taskMutation is a new object each render) or leak a baseline across sessions.
  return buildFieldHandlers(task, { taskMutation, user });
};
