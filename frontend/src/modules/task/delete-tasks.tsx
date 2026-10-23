import { DeleteItems, type DeleteItemsProps } from '~/modules/common/delete-items';
import { useTaskDeleteMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';

interface DeleteTasksProps extends Pick<DeleteItemsProps<Task, Task[]>, 'callback' | 'onCancel'> {
  tasks: Task[];
}

export function DeleteTasks({ tasks, ...props }: DeleteTasksProps) {
  // All tasks belong to one organization, so the first one carries the ids.
  const mutation = useTaskDeleteMutation(tasks[0].tenantId, tasks[0].organizationId);

  return <DeleteItems items={tasks} mutation={mutation} toVariables={(items) => items} {...props} />;
}
