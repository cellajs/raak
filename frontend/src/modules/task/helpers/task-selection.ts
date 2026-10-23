import { taskInteractionStore } from '~/modules/task/task-interaction-store';
import type { Task } from '~/modules/task/types';

type CheckedState = boolean | 'indeterminate';

export const handleTaskSelect = (state: CheckedState, task: Task) => {
  const { selectedTaskIds, setSelectedTaskIds } = taskInteractionStore.getState();

  if (state === true) return setSelectedTaskIds([...selectedTaskIds, task.id], task.projectId);
  if (state === false) return setSelectedTaskIds(selectedTaskIds.filter((id) => id !== task.id));
};
