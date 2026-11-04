import type { QueryCacheNotifyEvent } from '@tanstack/react-query';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { taskKeys } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { getQueryItems, getSimilarQueries } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';

const isTaskQueryEvent = ({ query }: QueryCacheNotifyEvent) => {
  const key = query?.queryKey;
  return Array.isArray(key) && key[0] === 'task';
};

// Task keys only: a broad subscription re-runs the snapshot on unrelated query events and can trip React's setState-in-render warning.
// Module-level, so useSyncExternalStore does not resubscribe each render.
// Deferred: a suspending query notifies the cache while its component renders, when no other component may update
const subscribeToTaskEvents = (onStoreChange: () => void, isRelevant: (event: QueryCacheNotifyEvent) => boolean) =>
  queryClient.getQueryCache().subscribe((event) => {
    if (isTaskQueryEvent(event) && isRelevant(event)) queueMicrotask(onStoreChange);
  });

/** Every event on a task query, for a snapshot of which queries are active: only an observer's arrival or leaving changes that. */
export const subscribeToTaskQueries = (onStoreChange: () => void) => subscribeToTaskEvents(onStoreChange, () => true);

/** What can change the cached tasks. Not observers: each view over the tasks adds some per project, which would re-run a snapshot walking every task. */
export const subscribeToTaskCache = (onStoreChange: () => void) => subscribeToTaskEvents(onStoreChange, ({ type }) => !type.startsWith('observer'));

export const cachedTasks = (): Task[] => {
  const queries = getSimilarQueries<Task>(taskKeys.list.base);

  return queries.flatMap(([, data]) => (data ? getQueryItems(data) : []));
};

/** The task for `taskId`, else the focused board item, else the focused DOM element. */
export const currentActiveTask = (taskId?: string): Task | undefined => {
  const id = taskId || useBoardFocusStore.getState().currentItemId || document.activeElement?.id;
  return id ? cachedTasks().find((task) => task.id === id) : undefined;
};
