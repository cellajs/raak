import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClientProvider as BaseQueryClientProvider, type UseInfiniteQueryOptions, type UseQueryOptions } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { config } from 'config';
import { useEffect } from 'react';
import { queryClient } from '~/lib/router';
import type { GetTasksParams } from './api/tasks';
import * as tasksApi from './api/tasks';
import { membersQueryOptions } from './modules/organizations/members-table/helpers/query-options';
import { organizationQueryOptions } from './modules/organizations/organization-page';
import { tasksQueryOptions } from './modules/projects/board/board-column';
import { getAndSetMe, getAndSetMenu } from './modules/users/helpers';
import { workspaceQueryOptions } from './modules/workspaces/helpers/query-options';
import { useGeneralStore } from './store/general';
import type { SubTask, Task } from './types/app';
import type { ContextEntity } from './types/common';

const GC_TIME = 24 * 60 * 60 * 1000; // 24 hours

const localStoragePersister = createSyncStoragePersister({
  storage: config.mode === 'production' ? window.localStorage : window.sessionStorage,
});

export type TasksMutationQueryFnVariables = Parameters<typeof tasksApi.updateTask>[0] & {
  projectId?: string;
};
type InfiniteQueryFnData = {
  items: Task[];
  total: number;
};

export const taskKeys = {
  all: () => ['tasks'] as const,
  lists: () => [...taskKeys.all(), 'list'] as const,
  list: (filters?: GetTasksParams) => [...taskKeys.lists(), filters] as const,
  update: () => [...taskKeys.all(), 'update'] as const,
};

// Helper function to update a task by its ID
const updateTask = <T extends Task | SubTask>(task: T, variables: TasksMutationQueryFnVariables): T => {
  return { ...task, [variables.key]: variables.data };
};

// Helper function to update a subtask within the parent
const updateSubtasks = (subTasks: SubTask[], taskId: string, variables: TasksMutationQueryFnVariables) => {
  return subTasks.map((subTask) => {
    if (subTask.id === taskId) {
      return updateTask(subTask, variables); // Update the subtask
    }
    return subTask; // No changes
  });
};

queryClient.setMutationDefaults(taskKeys.update(), {
  mutationFn: (variables: TasksMutationQueryFnVariables) => tasksApi.updateTask(variables),
  onMutate: async (variables) => {
    const { id: taskId, projectId } = variables;
    const listParams = projectId ? { projectId } : undefined;
    // Cancel any outgoing refetches
    // (so they don't overwrite our optimistic update)
    await queryClient.cancelQueries({ queryKey: taskKeys.list(listParams) });
    // Snapshot the previous value
    const previousTasks = queryClient.getQueryData<InfiniteQueryFnData>(taskKeys.list(listParams));

    // Optimistically update to the new value
    if (previousTasks) {
      queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list(listParams), (old) => {
        if (!old) {
          return {
            items: [],
            total: 0,
          };
        }

        const updatedTasks = old.items.map((task) => {
          // Update the task itself
          if (task.id === taskId) {
            const t = updateTask(task, variables);
            console.log('Optimistic update:', t, variables);
            return t;
          }

          // If the task is the parent, update its subtasks
          if (task.subTasks) {
            const updatedSubtasks = updateSubtasks(task.subTasks, taskId, variables);
            return { ...task, subTasks: updatedSubtasks }; // Return parent with updated subtasks
          }

          // No changes, return task as-is
          return task;
        });

        return {
          ...old,
          items: updatedTasks,
        };
      });
    }

    // Return a context object with the snapshotted value
    return { previousTasks };
  },
  onSuccess: (updatedTask, { id: taskId, projectId }) => {
    const listParams = projectId ? { projectId } : undefined;
    queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list(listParams), (oldData) => {
      if (!oldData) {
        return {
          items: [],
          total: 0,
        };
      }

      const updatedTasks = oldData.items.map((task) => {
        // Update the task itself
        if (task.id === taskId) {
          return updatedTask;
        }

        // If the task is the parent, update its subtasks
        if (task.subTasks) {
          const updatedSubtasks = task.subTasks.map((subTask) => (subTask.id === taskId ? updatedTask : subTask));
          return { ...task, subTasks: updatedSubtasks }; // Return parent with updated subtasks
        }

        // No changes, return task as-is
        return task;
      });

      return {
        ...oldData,
        items: updatedTasks,
      };
    });
  },
  onError: (_, { projectId }, context) => {
    if (context?.previousTasks) {
      const listParams = projectId ? { projectId } : undefined;
      queryClient.setQueryData(taskKeys.list(listParams), context.previousTasks);
    }
  },
});

type InferType<T> = T extends UseQueryOptions<infer D> ? D : T extends UseInfiniteQueryOptions<infer D> ? D : never;
// biome-ignore lint/suspicious/noExplicitAny: any is used to infer the type of the options
async function prefetchQuery<T extends UseQueryOptions<any, any, any, any>>(options: T): Promise<InferType<T>>;
// biome-ignore lint/suspicious/noExplicitAny: any is used to infer the type of the options
async function prefetchQuery<T extends UseInfiniteQueryOptions<any, any, any, any>>(options: T): Promise<InferType<T>>;
async function prefetchQuery(options: UseQueryOptions | UseInfiniteQueryOptions) {
  await queryClient.invalidateQueries({
    queryKey: options.queryKey,
  });
  if ('getNextPageParam' in options) {
    return queryClient.fetchInfiniteQuery({
      ...options,
      gcTime: GC_TIME,
    });
  }
  return queryClient.fetchQuery({
    ...options,
    gcTime: GC_TIME,
  });
}

const prefetchMembers = async (item: {
  slug: string;
  entity: ContextEntity;
}) => {
  const membersOptions = membersQueryOptions({ idOrSlug: item.slug, entityType: item.entity, limit: 40 });
  prefetchQuery(membersOptions);
};

export const QueryClientProvider = ({ children }: { children: React.ReactNode }) => {
  const { networkMode } = useGeneralStore();

  useEffect(() => {
    if (networkMode === 'offline') {
      (async () => {
        // Invalidate and prefetch me and menu
        const meQueryOptions: UseQueryOptions = {
          queryKey: ['me'],
          queryFn: getAndSetMe,
          gcTime: GC_TIME,
        };
        prefetchQuery(meQueryOptions);
        const menuQueryOptions = {
          queryKey: ['menu'],
          queryFn: getAndSetMenu,
          gcTime: GC_TIME,
        } satisfies UseQueryOptions;
        const menu = await prefetchQuery(menuQueryOptions);

        for (const section of Object.values(menu)) {
          for (const item of section) {
            if (item.entity === 'organization') {
              const options = organizationQueryOptions(item.slug);
              prefetchQuery(options);
              prefetchMembers(item);
              continue;
            }

            if (item.entity === 'workspace') {
              const options = workspaceQueryOptions(item.slug);
              prefetchQuery(options);
              prefetchMembers(item);

              for (const subItem of item.submenu ?? []) {
                if (subItem.entity === 'project') {
                  const options = tasksQueryOptions({ projectId: subItem.id });
                  prefetchQuery(options);
                }
              }
            }
          }
        }
      })();
    }
  }, [networkMode]);

  if (networkMode === 'online') {
    return <BaseQueryClientProvider client={queryClient}>{children}</BaseQueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: localStoragePersister }}
      onSuccess={() => {
        // resume mutations after initial restore from localStorage was successful
        queryClient.resumePausedMutations().then(() => {
          queryClient.invalidateQueries();
        });
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
