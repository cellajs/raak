import { useMutation } from '@tanstack/react-query';
import { type GetTasksParams, updateTask } from '~/api/tasks';
import { queryClient } from '~/lib/router';
import type { SubTask, Task } from '~/types/app';

export type TasksMutationQueryFnVariables = Parameters<typeof updateTask>[0] & {
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

export const useTaskMutation = () => {
  return useMutation<Task, Error, TasksMutationQueryFnVariables>({
    mutationKey: taskKeys.update(),
    mutationFn: updateTask,
  });
};

// Helper function to update a task property
const updateTaskProperty = <T extends Task | SubTask>(task: T, variables: TasksMutationQueryFnVariables): T => {
  return { ...task, [variables.key]: variables.data };
};

// Helper function to update a subtask within the parent
const updateSubtasks = (subTasks: SubTask[], taskId: string, variables: TasksMutationQueryFnVariables) => {
  return subTasks.map((subTask) => {
    if (subTask.id === taskId) {
      return updateTaskProperty(subTask, variables); // Update the subtask
    }
    return subTask; // No changes
  });
};

queryClient.setMutationDefaults(taskKeys.update(), {
  mutationFn: (variables: TasksMutationQueryFnVariables) => updateTask(variables),
  onMutate: async (variables) => {
    const { id: taskId, orgIdOrSlug, projectId } = variables;

    // Cancel any outgoing refetches
    // (so they don't overwrite our optimistic update)
    await queryClient.cancelQueries({ queryKey: taskKeys.list({ orgIdOrSlug, projectId }) });
    // Snapshot the previous value
    const previousTasks = queryClient.getQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug, projectId }));

    // Optimistically update to the new value
    if (previousTasks) {
      queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug, projectId }), (old) => {
        if (!old) {
          return {
            items: [],
            total: 0,
          };
        }

        const updatedTasks = old.items.map((task) => {
          // Update the task itself
          if (task.id === taskId) {
            const t = updateTaskProperty(task, variables);
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
  onSuccess: (updatedTask, { id: taskId, orgIdOrSlug, projectId }) => {
    queryClient.setQueryData<InfiniteQueryFnData>(taskKeys.list({ orgIdOrSlug, projectId }), (oldData) => {
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
  onError: (_, { orgIdOrSlug, projectId }, context) => {
    if (context?.previousTasks) {
      queryClient.setQueryData(taskKeys.list({ orgIdOrSlug, projectId }), context.previousTasks);
    }
  },
});
