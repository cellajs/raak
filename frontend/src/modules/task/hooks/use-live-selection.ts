import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import type { Task } from '~/modules/task/types';

/**
 * Track a task's multi-select field (labels / assignedTo) locally while its dropdown is open.
 *
 * The dropdowner renders a snapshot, so the `value` prop won't update on cache changes. This
 * subscribes to the task in cache (via `taskId`) and reconciles local state whenever the live
 * field changes, comparing by id set so local optimistic echoes don't cause redundant writes.
 * Falls back to `fallback` for create-task forms where no cached task exists yet.
 */
export const useLiveSelection = <T extends { id: string }>(
  taskId: string | undefined,
  select: (task: Task) => T[],
  fallback: T[],
): [T[], Dispatch<SetStateAction<T[]>>] => {
  const { data: liveTask } = useTaskQuery(taskId);
  const live = liveTask ? select(liveTask) : fallback;

  const [selected, setSelected] = useState<T[]>(live);

  // Reconcile only when the live field changes (deps intentionally exclude `selected`).
  useEffect(() => {
    const localIds = selected
      .map((x) => x.id)
      .sort()
      .join(',');
    const remoteIds = live
      .map((x) => x.id)
      .sort()
      .join(',');
    if (localIds !== remoteIds) setSelected(live);
  }, [live]);

  return [selected, setSelected];
};
