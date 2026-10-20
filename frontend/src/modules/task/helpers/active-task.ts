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
  const tasks = cachedTasks();
  if (!tasks.length) return;

  // Explicit taskId
  if (taskId) return tasks.find((t) => t.id === taskId);

  const storeFocusedId = useBoardFocusStore.getState().currentItemId;
  if (storeFocusedId) return tasks.find((t) => t.id === storeFocusedId);

  // DOM-focused element
  const activeId = document.activeElement?.id;
  if (activeId) return tasks.find((t) => t.id === activeId);

  return;
};
