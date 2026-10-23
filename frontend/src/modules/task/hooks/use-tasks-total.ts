import { useSearch } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import { matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { type BaseTasksQueryParam, taskKeys } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { isQueryData } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';
import type { QueryData } from '~/query/types';

// Task keys only: a broad subscription re-runs the snapshot on unrelated query events and can trip React's setState-in-render warning.
// Module-level, so useSyncExternalStore does not resubscribe each render.
export const subscribeToTaskCache = (onStoreChange: () => void) =>
  queryClient.getQueryCache().subscribe((event) => {
    const key = event.query?.queryKey;
    if (Array.isArray(key) && key[0] === 'task') onStoreChange();
  });

/** Total of the tasks on the board; while a search is active, the matches among the loaded tasks. */
export const useTasksTotal = (queryParams?: BaseTasksQueryParam) => {
  const q = useSearch({ strict: false, select: (search) => search.q });
  const matchMode = useSearch({ strict: false, select: (search) => search.matchMode });

  const isSearching = !!q?.trim();
  const queryKey = queryParams ? taskKeys.list.org(queryParams.organizationId) : taskKeys.publicList.filtered({ projectId: '', public: true });

  return useSyncExternalStore(subscribeToTaskCache, () => {
    const queries = queryClient.getQueriesData<QueryData<Task>>({ queryKey, type: 'active' });

    if (!queries.length) return null;

    return queries.reduce((total, [, data]) => {
      if (!isQueryData<Task>(data)) return total;
      if (isSearching) return total + data.items.filter((task) => matchesBoardSearch({ q, matchMode }, task)).length;
      return total + data.total;
    }, 0);
  });
};
