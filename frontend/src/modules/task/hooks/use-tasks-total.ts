import { useSyncExternalStore } from 'react';
import { useSearchParams } from '~/hooks/use-search-params';
import { searchFilterFunction } from '~/modules/task/helpers/search-filter';
import { publicTasksTableQueryOptions } from '~/modules/task/public-query';
import {
  type BaseTasksQueryParam,
  type TasksInfiniteQueryData,
  type TasksQueryData,
  taskKeys,
  tasksTableQueryOptions,
} from '~/modules/task/query';
import { queryClient } from '~/query/query-client';

export const useTasksTotal = (mode: 'board' | 'table', queryParams?: BaseTasksQueryParam) => {
  const { search } = useSearchParams<{ q?: string }>({});
  const isPublicView = !queryParams;

  const searchQuery = search.q?.trim();
  // Exclude tenantId — not part of query keys
  const { tenantId: _, organizationId, ...scopeFilters } = queryParams ?? { organizationId: '', projectId: '' };

  return useSyncExternalStore(
    // Subscribe only to task-related query cache updates. A broad subscription
    // re-runs the snapshot for every unrelated query lifecycle event (e.g. an
    // AI chat panel mounting its own useQuery hooks), which can schedule a
    // BoardHeader update mid-render of another component and trip React's
    // "setState in render" warning.
    (onStoreChange) =>
      queryClient.getQueryCache().subscribe((event) => {
        const key = event.query?.queryKey;
        if (Array.isArray(key) && key[0] === 'task') onStoreChange();
      }),

    // Calculate the snapshot of the total task count
    () => {
      if (mode === 'board') {
        const queryKey = !isPublicView
          ? taskKeys.list.org(organizationId)
          : taskKeys.publicList.filtered({ ...scopeFilters, publicAt: true as const });
        const queries = queryClient.getQueriesData<TasksQueryData>({ queryKey, type: 'active' });

        if (!queries.length) return null;

        return queries.reduce((total, [, data]) => {
          if (!data) return total;
          if (searchQuery?.length)
            return total + data.items.filter((task) => searchFilterFunction(search, task)).length;
          return total + data.total;
        }, 0);
      }

      const { queryKey } = queryParams
        ? tasksTableQueryOptions({ ...search, ...queryParams })
        : publicTasksTableQueryOptions({ ...search, projectId: scopeFilters.projectId! });

      const queryData = queryClient.getQueryData<TasksInfiniteQueryData>(queryKey);

      if (!queryData?.pages.length) return null;

      // Return total from last page
      return queryData.pages[queryData.pages.length - 1].total;
    },
  );
};
