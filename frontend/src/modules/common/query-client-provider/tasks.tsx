import { type QueryKey, useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { toast } from 'sonner';
import { type GetTasksParams, createTask, deleteTasks, updateTask } from '~/api/tasks';
import { queryClient } from '~/lib/router';
import type { Subtask, Task } from '~/types/app';
import { nanoid } from '~/utils/nanoid';

export type TasksCreateMutationQueryFnVariables = Parameters<typeof createTask>[0];

type TasksUpdateParams = Parameters<typeof updateTask>[0];
export type TasksUpdateMutationQueryFnVariables = Omit<TasksUpdateParams, 'data'> & {
  projectId?: string;
  data: TasksUpdateParams['data'] | { id: string }[];
};
export type TasksDeleteMutationQueryFnVariables = Parameters<typeof deleteTasks>[0] & {
  projectIds: string[];
};

type QueryFnData = {
  items: Task[];
  total: number;
};

type InfiniteQueryFnData = {
  pageParams: number[];
  pages: QueryFnData[];
};

export const taskKeys = {
  all: () => ['tasks'] as const,
  lists: () => [...taskKeys.all(), 'list'] as const,
  list: (filters?: GetTasksParams) => [...taskKeys.lists(), filters] as const,
  table: (filters?: GetTasksParams) => [...taskKeys.all(), 'table', filters] as const,
  create: () => [...taskKeys.all(), 'create'] as const,
  update: () => [...taskKeys.all(), 'update'] as const,
  delete: () => [...taskKeys.all(), 'delete'] as const,
};

const transformUpdateData = (variables: TasksUpdateMutationQueryFnVariables) => {
  const transformedVariables = {
    ...variables,
    data: Array.isArray(variables.data) ? variables.data.map((item) => (typeof item === 'string' ? item : item.id)) : variables.data,
  };

  return transformedVariables;
};

export const useTaskCreateMutation = () => {
  return useMutation<Task, Error, TasksCreateMutationQueryFnVariables>({
    mutationKey: taskKeys.create(),
    mutationFn: createTask,
  });
};

export const useTaskUpdateMutation = () => {
  return useMutation<Pick<Task, 'summary' | 'description' | 'expandable'>, Error, TasksUpdateMutationQueryFnVariables>({
    mutationKey: taskKeys.update(),
    mutationFn: (variables) => updateTask(transformUpdateData(variables)),
  });
};

export const useTaskDeleteMutation = () => {
  return useMutation<boolean, Error, TasksDeleteMutationQueryFnVariables>({
    mutationKey: taskKeys.delete(),
    mutationFn: deleteTasks,
  });
};

// Helper function to update a task property
const updateTaskProperty = <T extends Task | Subtask>(task: T, variables: TasksUpdateMutationQueryFnVariables): T => {
  return { ...task, [variables.key]: variables.data };
};

// Helper function to update a subtask within the parent
const updateSubtasks = (subtasks: Subtask[], taskId: string, variables: TasksUpdateMutationQueryFnVariables) => {
  return subtasks.map((subtask) => {
    if (subtask.id === taskId) {
      return updateTaskProperty(subtask, variables); // Update the subtask
    }
    return subtask; // No changes
  });
};

const getPreviousTasks = async (passedKey: QueryKey) => {
  // Snapshot the previous value
  const queries = getQueries(passedKey);

  for (const query of queries) {
    const [queryKey, _] = query;
    // Cancel any outgoing refetches
    // (so they don't overwrite our optimistic update)
    await queryClient.cancelQueries({ queryKey });
  }

  return queries;
};

const isProjectObject = (el: unknown): el is { projectId: string } => {
  return typeof el === 'object' && el !== null && 'projectId' in el;
};

// TODO refactor to handle also table query(better way for it)
const getQueries = (queryKey: QueryKey) => {
  const activeQueries = queryClient.getQueriesData<InfiniteQueryFnData | QueryFnData>({ fetchStatus: 'idle' });

  const { projectId } = queryKey.find(isProjectObject) || { projectId: '' };

  const projectQueries = activeQueries.filter(([keys, _]) => {
    // Find the projectId in each queryKey and compare it
    const { projectId: existingQueriesProjectId } = keys.find(isProjectObject) || {};
    return existingQueriesProjectId?.includes(projectId) && keys.includes('tasks') && (keys.includes('list') || keys.includes('table'));
  });

  return projectQueries;
};

// Type guard to determine if the data is QueryFnData
function isQueryFnData(data: unknown): data is QueryFnData {
  return typeof data === 'object' && data !== null && 'items' in data && 'total' in data;
}

const onError = (
  _: Error,
  { organizationId, projectId, orgIdOrSlug }: TasksUpdateMutationQueryFnVariables & TasksCreateMutationQueryFnVariables,
  context?: { previousTasks?: QueryFnData | InfiniteQueryFnData },
) => {
  orgIdOrSlug = organizationId || orgIdOrSlug;
  if (context?.previousTasks && orgIdOrSlug && projectId) {
    queryClient.setQueryData(taskKeys.list({ orgIdOrSlug, projectId }), context.previousTasks);
  }
  toast.error(t('common:error.create_resource', { resource: t('app:task') }));
};

queryClient.setMutationDefaults(taskKeys.create(), {
  mutationFn: createTask,
  onMutate: async (variables) => {
    const { id: taskId, organizationId, projectId, parentId, impact } = variables;

    const optimisticId = taskId || nanoid();
    const newTask: Task = {
      ...variables,
      id: optimisticId,
      impact: impact || null,
      expandable: false,
      parentId: parentId || null,
      labels: [],
      subtasks: [],
      entity: 'task',
      assignedTo: [],
      createdAt: new Date().toISOString(),
      createdBy: null,
      modifiedAt: new Date().toISOString(),
      modifiedBy: null,
    };

    const projectQueries = await getPreviousTasks(taskKeys.list({ orgIdOrSlug: organizationId, projectId }));
    const contexts: Record<string, { previousTasks?: QueryFnData | InfiniteQueryFnData; optimisticId: string }> = {};

    for (const query of projectQueries) {
      const [queryKey, previousTasks] = query;
      const { projectId } = queryKey.find(isProjectObject) || { projectId: '' };

      if (previousTasks) {
        queryClient.setQueryData<InfiniteQueryFnData | QueryFnData>(queryKey, (old) => {
          if (!old) {
            const pages = {
              items: [],
              total: 0,
            };
            if (isQueryFnData(previousTasks)) return pages;
            return { pageParams: [0], pages: [pages] };
          }

          let tasks: Task[];

          // If old is QueryFnData
          if (isQueryFnData(old)) tasks = old.items;
          // If old is InfiniteQueryFnData
          else tasks = old.pages.flatMap((page) => page.items); // Flatten the items from all pages

          let updatedTasks: Task[];
          if (tasks.some((el) => el.id === newTask.parentId)) {
            updatedTasks = tasks.map((task) => {
              // Update the parent task
              if (task.id === parentId) {
                const t = { ...task, subtasks: [...task.subtasks, newTask] };
                return t;
              }
              // No changes, return task as-is
              return task;
            });
          } else updatedTasks = [...tasks, newTask];

          if (isQueryFnData(old)) return { total: updatedTasks.length, items: updatedTasks };

          return {
            ...old,
            pages: [{ total: updatedTasks.length, items: updatedTasks }],
          };
        });
      }

      contexts[projectId] = { previousTasks, optimisticId };
    }

    return contexts;
  },
  onSuccess: (createdTask, { organizationId, projectId }, contexts) => {
    const queries = getQueries(taskKeys.list({ orgIdOrSlug: organizationId, projectId }));
    for (const query of queries) {
      const [activeKey, _] = query;
      queryClient.setQueryData<InfiniteQueryFnData | QueryFnData>(activeKey, (oldData) => {
        if (!oldData) {
          const pages = {
            items: [],
            total: 0,
          };
          if (isQueryFnData(oldData)) return pages;
          return { pageParams: [0], pages: [pages] };
        }

        let tasks: Task[];

        // If oldData is QueryFnData
        if (isQueryFnData(oldData)) tasks = oldData.items;
        // If oldData is InfiniteQueryFnData
        else tasks = oldData.pages.flatMap((page) => page.items); // Flatten the items from all pages

        const { projectId } = activeKey.find(isProjectObject) || { projectId: '' };
        const { optimisticId } = contexts[projectId];
        const updatedTasks = tasks.map((task) => {
          // Update the task itself
          if (task.id === optimisticId) return createdTask;

          // If the task is the parent, update its subtasks
          if (task.id === createdTask.parentId) {
            const updatedSubtasks = task.subtasks.map((subtask) => (subtask.id === optimisticId ? createdTask : subtask));
            return { ...task, subtasks: updatedSubtasks }; // Return parent with updated subtasks
          }

          // No changes, return task as-is
          return task;
        });

        if (isQueryFnData(oldData)) return { total: updatedTasks.length, items: updatedTasks };

        return {
          ...oldData,
          pages: [{ total: updatedTasks.length, items: updatedTasks }],
        };
      });
    }
    toast.success(t('common:success.create_resource', { resource: t(createdTask.parentId ? 'app:todo' : 'app:task') }));
  },
  onError,
});

queryClient.setMutationDefaults(taskKeys.update(), {
  mutationFn: (variables) => updateTask(transformUpdateData(variables)),
  onMutate: async (variables: TasksUpdateMutationQueryFnVariables) => {
    const { id: taskId, orgIdOrSlug, projectId } = variables;
    const contexts: Record<string, { previousTasks?: QueryFnData | InfiniteQueryFnData }> = {};

    const projectQueries = await getPreviousTasks(taskKeys.list({ orgIdOrSlug, projectId }));

    for (const query of projectQueries) {
      const [queryKey, previousTasks] = query;

      const { projectId } = queryKey.find(isProjectObject) || { projectId: '' };
      // Optimistically update to the new value
      if (previousTasks) {
        queryClient.setQueryData<InfiniteQueryFnData | QueryFnData>(queryKey, (old) => {
          if (!old) {
            const pages = {
              items: [],
              total: 0,
            };
            if (isQueryFnData(previousTasks)) return pages;
            return { pageParams: [0], pages: [pages] };
          }

          let tasks: Task[];

          // If old is QueryFnData
          if (isQueryFnData(old)) tasks = old.items;
          // If old is InfiniteQueryFnData
          else tasks = old.pages.flatMap((page) => page.items); // Flatten the items from all pages

          const updatedTasks = tasks.map((task) => {
            // Update the task itself
            if (task.id === taskId) {
              const t = updateTaskProperty(task, variables);
              if (variables.order && variables.order !== t.order) t.order = variables.order;
              return t;
            }

            // If the task is the parent, update its subtasks
            if (task.subtasks) {
              //TODO maybe sort in some other way
              const updatedSubtasks = updateSubtasks(task.subtasks, taskId, variables);
              return { ...task, subtasks: updatedSubtasks.sort((a, b) => b.order - a.order) }; // Return parent with updated subtasks
            }

            // No changes, return task as-is
            return task;
          });

          if (isQueryFnData(old)) return { total: updatedTasks.length, items: updatedTasks };

          return {
            ...old,
            pages: [{ total: updatedTasks.length, items: updatedTasks }],
          };
        });
      }

      // Return a context object with the snapshotted value
      contexts[projectId] = { previousTasks };
    }
    return contexts;
  },
  onSuccess: async (updatedTask, { id: taskId, orgIdOrSlug, projectId }) => {
    const queries = getQueries(taskKeys.list({ orgIdOrSlug, projectId }));

    for (const query of queries) {
      const [activeKey] = query;
      queryClient.setQueryData<InfiniteQueryFnData | QueryFnData>(activeKey, (oldData) => {
        if (!oldData) {
          const pages = {
            items: [],
            total: 0,
          };
          if (isQueryFnData(oldData)) return pages;
          return { pageParams: [0], pages: [pages] };
        }

        let tasks: Task[];

        // If oldData is QueryFnData
        if (isQueryFnData(oldData)) tasks = oldData.items;
        // If oldData is InfiniteQueryFnData
        else tasks = oldData.pages.flatMap((page) => page.items); // Flatten the items from all pages

        const updatedTasks = tasks.map((task) => {
          // Update the task itself
          if (task.id === taskId) {
            return {
              ...task,
              ...updatedTask,
            };
          }

          // If the task is the parent, update its subtasks
          if (task.subtasks) {
            const updatedSubtasks = task.subtasks.map((subtask) =>
              subtask.id === taskId
                ? {
                    ...subtask,
                    ...updatedTask,
                  }
                : subtask,
            );
            return { ...task, subtasks: updatedSubtasks }; // Return parent with updated subtasks
          }

          // No changes, return task as-is
          return task;
        });

        if (isQueryFnData(oldData)) return { total: updatedTasks.length, items: updatedTasks };

        return {
          ...oldData,
          pages: [{ total: updatedTasks.length, items: updatedTasks }],
        };
      });
    }
  },
  onError,
});

queryClient.setMutationDefaults(taskKeys.delete(), {
  mutationFn: ({ ids, orgIdOrSlug }: TasksDeleteMutationQueryFnVariables) => deleteTasks({ ids, orgIdOrSlug }),
  onMutate: async (variables) => {
    const { ids, projectIds, orgIdOrSlug } = variables;

    const contexts: Record<string, { previousTasks?: QueryFnData | InfiniteQueryFnData }> = {}; // Store the previous state for each project

    // Iterate over each projectId to update each project separately
    for (const projectId of projectIds) {
      const projectQueries = await getPreviousTasks(taskKeys.list({ orgIdOrSlug, projectId }));
      for (const query of projectQueries) {
        const [queryKey, previousTasks] = query;

        // Optimistically update to the new value
        if (previousTasks) {
          queryClient.setQueryData<InfiniteQueryFnData | QueryFnData>(queryKey, (old) => {
            if (!old) {
              const pages = {
                items: [],
                total: 0,
              };
              if (isQueryFnData(previousTasks)) return pages;
              return { pageParams: [0], pages: [pages] };
            }

            let tasks: Task[];

            // If old is QueryFnData
            if (isQueryFnData(old)) tasks = old.items;
            // If old is InfiniteQueryFnData
            else tasks = old.pages.flatMap((page) => page.items); // Flatten the items from all pages

            const updatedTasks = tasks
              .map((task) => {
                // Update the task itself
                if (ids.includes(task.id)) return null;

                // If the task is the parent, update its subtasks
                if (task.subtasks) {
                  const updatedSubtasks = task.subtasks.filter((subtask) => !ids.includes(subtask.id));
                  return { ...task, subtasks: updatedSubtasks }; // Return parent with updated subtasks
                }

                // No changes, return task as-is
                return task;
              })
              .filter(Boolean) as Task[];

            if (isQueryFnData(old)) return { total: updatedTasks.length, items: updatedTasks };

            return {
              ...old,
              pages: [{ total: updatedTasks.length, items: updatedTasks }],
            };
          });
        }

        // Store the previous tasks for this project in the context
        contexts[projectId] = { previousTasks };
      }
    }

    // Return a context object for all projects
    return contexts;
  },
  onError: async (_, { orgIdOrSlug, projectIds }, context) => {
    if (context) {
      for (const projectId of projectIds) {
        const queries = getQueries(taskKeys.list({ orgIdOrSlug, projectId }));

        for (const query of queries) {
          const [queryKey, _] = query;
          if (context[projectId]?.previousTasks) queryClient.setQueryData(queryKey, context[projectId].previousTasks);
        }
      }
    }
  },
});
