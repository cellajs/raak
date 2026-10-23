import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { useTaskQuery } from '~/modules/task/hooks/use-task-query';
import type { Task } from '~/modules/task/types';

/** Local state for a task's labels or assignees while its dropdown is open; follows the cached task, `fallback` serves create forms. */
export const useLiveSelection = <T extends { id: string }>(
  taskId: string | undefined,
  select: (task: Task) => T[],
  fallback: T[],
): [T[], Dispatch<SetStateAction<T[]>>] => {
  const { data: liveTask } = useTaskQuery(taskId);
  const live = liveTask ? select(liveTask) : fallback;

  const [selected, setSelected] = useState<T[]>(live);

  // Deps exclude `selected` on purpose: reconcile only when the live field changes
  useEffect(() => {
    const localIds = selected
      .map((item) => item.id)
      .sort()
      .join(',');
    const remoteIds = live
      .map((item) => item.id)
      .sort()
      .join(',');
    if (localIds !== remoteIds) setSelected(live);
  }, [live]);

  return [selected, setSelected];
};
