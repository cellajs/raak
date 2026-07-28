import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { Task } from '~/modules/task/types';

type CheckedState = boolean | 'indeterminate';

export const handleTaskSelect = (state: CheckedState, task: Task) => {
  const selectedTaskIds = useTaskInteractionStore.getState().selectedTaskIds;
  const setSelectedTaskIds = useTaskInteractionStore.getState().setSelectedTaskIds;

  if (state === true) return setSelectedTaskIds([...selectedTaskIds, task.id]);
  if (state === false) return setSelectedTaskIds(selectedTaskIds.filter((id) => id !== task.id));
};
