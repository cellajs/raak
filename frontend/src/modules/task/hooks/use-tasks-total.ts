import { useSearch } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';
import { subscribeToTaskCache } from '~/modules/task/helpers/active-task';
import { matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { type BaseTasksQueryParam, taskKeys } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { isQueryData } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';
import type { QueryData } from '~/query/types';

/** Total of the tasks on the board; while a search is active, the matches among the loaded tasks. */
export const useTasksTotal = (queryParams?: BaseTasksQueryParam) => {
  const q = useSearch({ strict: false, select: (search) => search.q });

  const isSearching = !!q?.trim();
  const queryKey = queryParams ? taskKeys.list.org(queryParams.organizationId) : taskKeys.publicList.base;

  return useSyncExternalStore(subscribeToTaskCache, () => {
    const queries = queryClient.getQueriesData<QueryData<Task>>({ queryKey, type: 'active' });

    if (!queries.length) return null;

    return queries.reduce((total, [, data]) => {
      if (!isQueryData<Task>(data)) return total;
      if (isSearching) return total + data.items.filter((task) => matchesBoardSearch(q, task)).length;
      return total + data.total;
    }, 0);
  });
};
