import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { taskKeys } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { getQueryItems, getSimilarQueries } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';

// Task keys only: a broad subscription re-runs the snapshot on unrelated query events and can trip React's setState-in-render warning.
// Module-level, so useSyncExternalStore does not resubscribe each render.
export const subscribeToTaskCache = (onStoreChange: () => void) =>
  queryClient.getQueryCache().subscribe((event) => {
    const key = event.query?.queryKey;
    // Deferred: a suspending query notifies the cache while its component renders, when no other component may update
    if (Array.isArray(key) && key[0] === 'task') queueMicrotask(onStoreChange);
  });

export const cachedTasks = (): Task[] => {
  const queries = getSimilarQueries<Task>(taskKeys.list.base);

  return queries.flatMap(([, data]) => (data ? getQueryItems(data) : []));
};

/** The task for `taskId`, else the focused board item, else the focused DOM element. */
export const currentActiveTask = (taskId?: string): Task | undefined => {
  const id = taskId || useBoardFocusStore.getState().currentItemId || document.activeElement?.id;
  return id ? cachedTasks().find((task) => task.id === id) : undefined;
};
