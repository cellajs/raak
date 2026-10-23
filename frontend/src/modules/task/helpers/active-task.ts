import { useBoardFocusStore } from '~/modules/board-focus/board-focus-store';
import { taskKeys } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { getQueryItems, getSimilarQueries } from '~/query/basic/mutate-query';

/** Returns all tasks available in the React Query cache. */
export const cachedTasks = (): Task[] => {
  const queries = getSimilarQueries<Task>(taskKeys.list.base);

  return queries.flatMap(([, data]) => (data ? getQueryItems(data) : []));
};

/** Returns the active task from cached task lists. */
export const currentActiveTask = (taskId?: string): Task | undefined => {
  const id = taskId || useBoardFocusStore.getState().currentItemId || document.activeElement?.id;
  return id ? cachedTasks().find((task) => task.id === id) : undefined;
};
