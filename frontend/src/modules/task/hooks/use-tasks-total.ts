import { useSyncExternalStore } from 'react';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { useSearchParams } from '~/hooks/use-search-params';
import { searchFilterFunction } from '~/modules/task/helpers/search-filter';
import { publicTasksTableQueryKey } from '~/modules/task/public-query';
import {
  type BaseTasksQueryParam,
  type TasksInfiniteQueryData,
  taskKeys,
  tasksTableQueryKey,
} from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { isQueryData } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';
import type { QueryData } from '~/query/types';

// Subscribe only to task-related query cache updates. A broad subscription re-runs the snapshot for
// every unrelated query lifecycle event (e.g. an AI chat panel mounting its own useQuery hooks),
// which can schedule a BoardHeader update mid-render of another component and trip React's
// "setState in render" warning. Hoisted to module scope so useSyncExternalStore doesn't resubscribe
// on every render.
const subscribeToTaskCache = (onStoreChange: () => void) =>
  queryClient.getQueryCache().subscribe((event) => {
    const key = event.query?.queryKey;
    if (Array.isArray(key) && key[0] === 'task') onStoreChange();
  });

/** Provides tasks total state and actions. */
export const useTasksTotal = (mode: 'board' | 'table', queryParams?: BaseTasksQueryParam) => {
  const { search } = useSearchParams<{ q?: string }>({});
  const isPublicView = !queryParams;

  const searchQuery = search.q?.trim();
  // Exclude tenantId because it is not part of query keys.
  const { tenantId: _, organizationId, ...scopeFilters } = queryParams ?? { organizationId: '', projectId: '' };

  return useSyncExternalStore(
    subscribeToTaskCache,

    // Calculate the snapshot of the total task count
    () => {
      if (mode === 'board') {
        const queryKey = !isPublicView
          ? taskKeys.list.org(organizationId)
          : taskKeys.publicList.filtered({ ...scopeFilters, publicAt: true as const });
        const queries = queryClient.getQueriesData<QueryData<Task>>({ queryKey, type: 'active' });

        if (!queries.length) return null;

        return queries.reduce((total, [, data]) => {
          if (!isQueryData<Task>(data)) return total;
          if (searchQuery?.length)
            return total + data.items.filter((task) => searchFilterFunction(search, task)).length;
          return total + data.total;
        }, 0);
      }

      // Highlight mode fetches unfiltered (q stripped from the request), so mirror the
      // table's effective key and count the matches among loaded pages, like board mode.
      const { highlight } = parseSearchQuery(search.q);
      const effectiveSearch = highlight ? { ...search, q: '' } : search;

      const queryKey = queryParams
        ? tasksTableQueryKey({ ...effectiveSearch, ...queryParams })
        : publicTasksTableQueryKey({ ...effectiveSearch, projectId: scopeFilters.projectId! });

      const queryData = queryClient.getQueryData<TasksInfiniteQueryData>(queryKey);

      if (!queryData?.pages.length) return null;

      if (highlight) {
        return queryData.pages.reduce(
          (total, page) => total + page.items.filter((task) => searchFilterFunction(search, task)).length,
          0,
        );
      }

      return queryData.pages[queryData.pages.length - 1].total;
    },
  );
};
