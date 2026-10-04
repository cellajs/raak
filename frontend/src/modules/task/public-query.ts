import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { getPublicTask, getPublicTasks } from 'sdk';
import { appConfig } from 'shared';
import type { GetTasksParam } from '~/modules/task/query';
import { taskKeys, tasksTableQueryDefaults } from '~/modules/task/query';
import { boardAcceptedCutOff } from '~/modules/task/task-properties';
import { offsetPaging, pageQuery } from '~/query/basic/infinite-query-options';

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
      getPublicTasks({ query: { projectId, acceptedCutOff: boardAcceptedCutOff, offset: '0', limit: String(appConfig.requestLimits.tasks) } }),
    gcTime: 0,
    staleTime: 0,
  });
};

type PublicTasksTableParams = Omit<GetTasksParam, 'acceptedCutOff' | 'organizationId' | 'workspaceId' | 'tenantId'> & { projectId: string };

/** The public tasks-table infinite query key (shared with use-tasks-total's count snapshot). */
export const publicTasksTableQueryKey = ({
  q,
  sort = tasksTableQueryDefaults.sort,
  order = tasksTableQueryDefaults.order,
  matchMode = tasksTableQueryDefaults.matchMode,
  projectId,
}: PublicTasksTableParams) => taskKeys.publicList.filtered({ q, sort, order, projectId, matchMode, publicAt: true as const });

export const publicTasksTableQueryOptions = ({
  q,
  sort = tasksTableQueryDefaults.sort,
  order = tasksTableQueryDefaults.order,
  matchMode = tasksTableQueryDefaults.matchMode,
  limit = appConfig.requestLimits.tasksTable,
  projectId,
}: PublicTasksTableParams & { limit?: number }) => {
  const query = { q, sort, order, projectId, matchMode };

  return infiniteQueryOptions({
    queryKey: publicTasksTableQueryKey({ q, sort, order, matchMode, projectId }),
    ...offsetPaging(limit, (offset, signal) => getPublicTasks({ query: { ...query, ...pageQuery(limit, offset) }, signal })),
    refetchOnWindowFocus: false,
    gcTime: 0,
    staleTime: 0,
  });
};
