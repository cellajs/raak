import type { QueryKey } from '@tanstack/react-query';
import { useRef, useSyncExternalStore } from 'react';
import { subscribeToTaskCache } from '~/modules/task/helpers/active-task';
import type { Task } from '~/modules/task/types';
import { isQueryData } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';

const noTasks: Task[] = [];

/**
 * A string worked out from the cached task lists at `queryKeys`, so useSyncExternalStore compares it by value.
 * It reuses the last result while the lists are the same arrays and `inputKey` holds: the snapshot also runs on each render and for a fetch that
 * changes nothing, and working it out walks every task. A null `inputKey` works nothing out, and gives an empty string.
 */
export const useTaskListsSnapshot = (queryKeys: QueryKey[], inputKey: string | null, compute: (tasks: Task[]) => string) => {
  const last = useRef<{ taskLists: Task[][]; inputKey: string; result: string } | null>(null);

  return useSyncExternalStore(subscribeToTaskCache, () => {
    if (inputKey === null) return '';
    const taskLists = queryKeys.map((queryKey) => {
      const data = queryClient.getQueryData(queryKey);
      return isQueryData<Task>(data) ? data.items : noTasks;
    });
    const previous = last.current;
    if (
      previous?.inputKey === inputKey &&
      previous.taskLists.length === taskLists.length &&
      taskLists.every((items, index) => items === previous.taskLists[index])
    ) {
      return previous.result;
    }
    const result = compute(taskLists.flat());
    last.current = { taskLists, inputKey, result };
    return result;
  });
};
