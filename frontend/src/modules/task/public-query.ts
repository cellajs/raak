import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getPublicTask, getPublicTasks } from 'sdk';
import { appConfig } from 'shared';
import type { GetTasksParam } from '~/modules/task/query';
import { getTasksNextPageParam, taskKeys } from '~/modules/task/query';
import { tasksSearchDefaults } from '~/modules/task/search-params-schemas';
import { boardAcceptedCutOff } from '~/modules/task/task-properties';
import { baseInfiniteQueryOptions } from '~/query/basic/infinite-query-options';

export const publicTaskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: taskKeys.detail.public(id),
    queryFn: () => getPublicTask({ path: { id } }),
    gcTime: 0,
    staleTime: 0,
  });

export const publicTasksBoardQueryOptions = (projectId: string) => {
  return queryOptions({
    queryKey: taskKeys.publicList.filtered({ projectId, publicAt: true as const }),
    queryFn: () =>
      getPublicTasks({
        query: {
          projectId,
          acceptedCutOff: boardAcceptedCutOff,
          offset: '0',
          limit: String(appConfig.requestLimits.tasks),
        },
      }),
    gcTime: 0,
    staleTime: 0,
  });
};

type PublicTasksTableParams = Omit<GetTasksParam, 'acceptedCutOff' | 'organizationId' | 'workspaceId' | 'tenantId'> & {
  projectId: string;
};

/** The public tasks-table infinite query key (shared with use-tasks-total's count snapshot). */
export const publicTasksTableQueryKey = ({
  q,
  sort = tasksSearchDefaults.sort,
  order = tasksSearchDefaults.order,
  matchMode = tasksSearchDefaults.matchMode,
  projectId,
}: PublicTasksTableParams) =>
  taskKeys.publicList.filtered({ q, sort, order, projectId, matchMode, publicAt: true as const });

export const publicTasksTableQueryOptions = ({
  q,
  sort = tasksSearchDefaults.sort,
  order = tasksSearchDefaults.order,
  matchMode = tasksSearchDefaults.matchMode,
  limit: baseLimit = appConfig.requestLimits.tasksTable,
  projectId,
}: PublicTasksTableParams & { limit?: number }) => {
  const limit = String(baseLimit);
  const { initialPageParam } = baseInfiniteQueryOptions;

  const query = { q, sort, order, projectId, matchMode };
  const queryKey = publicTasksTableQueryKey({ q, sort, order, matchMode, projectId });

  return infiniteQueryOptions({
    queryKey,
    initialPageParam,
    refetchOnWindowFocus: false,
    queryFn: async ({ pageParam: { page, offset: _offset }, signal }) => {
      const offset = String(_offset || (page || 0) * Number(limit));
      return await getPublicTasks({ query: { ...query, limit, offset }, signal });
    },
    getNextPageParam: getTasksNextPageParam,
    gcTime: 0,
    staleTime: 0,
  });
};
