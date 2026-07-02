import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { Task } from '~/modules/task/types';

type CheckedState = boolean | 'indeterminate';

export const handleTaskSelect = (state: CheckedState, task: Task) => {
  const selectedTasks = useTaskInteractionStore.getState().selectedTasks;
  const setSelectedTasks = useTaskInteractionStore.getState().setSelectedTasks;

  if (state === true) return setSelectedTasks([...selectedTasks, task]);
  if (state === false) return setSelectedTasks(selectedTasks.filter(({ id }) => id !== task.id));
};
