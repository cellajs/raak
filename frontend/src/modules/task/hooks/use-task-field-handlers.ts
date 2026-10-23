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

// Deltas run against the previous selection, not the dropdown-open snapshot; findInCache is stale after squashed mutations' onSuccess
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

/** Field-level onChange handlers for an existing task; callable from hooks and plain functions. */
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

    const sortedAssignedTo = getItemsSortedByName([...currentTask.assignedTo, user]);
    const shouldAssignToSelf = newStatus === TaskStatus.Started && !currentTask.assignedTo.some(({ id }) => id === user.id);

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

/** Field-level onChange handlers for an existing task, each wrapping the task update mutation. */
export const useTaskFieldHandlers = (task: Task) => {
  const user = useCurrentUser();
  const taskMutation = useTaskUpdateMutation(task.tenantId, task.organizationId);

  // Not memoized: the baselines need one handler instance per dropdown session, which the dropdowner captures at open
  return buildFieldHandlers(task, { taskMutation, user });
};
