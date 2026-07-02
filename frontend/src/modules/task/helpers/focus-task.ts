import { currentActiveTask } from '~/modules/task/helpers/active-task';
import { scrollTaskIntoView } from '~/modules/task/helpers/panel-scroll-registry';
import { changeTaskState } from '~/modules/task/hooks/use-task-states';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';

export const focusTask = (taskId: string | null) => {
  const { focusedTaskId: currentFocused, setFocusedTaskId } = useTaskInteractionStore.getState();
  if (currentFocused) {
    changeTaskState(currentFocused, 'suppressEdit');
  }

  setFocusedTaskId(taskId);
};

// Try to focus a card across a few animation frames, giving virtua time to mount it after scrolling.
const focusWhenMounted = (id: string, attemptsLeft = 5) => {
  const taskCard = document.getElementById(id);
  if (taskCard) {
    if (document.activeElement !== taskCard) taskCard.focus();
    return;
  }
  if (attemptsLeft <= 0) return;
  requestAnimationFrame(() => focusWhenMounted(id, attemptsLeft - 1));
};

export const setTaskCardFocus = (id: string) => {
  focusTask(id);

  const taskCard = document.getElementById(id);
  if (taskCard) {
    if (document.activeElement !== taskCard) taskCard.focus();
    return;
  }

  // Card is virtualized out of the DOM: blur the previous element, scroll the target into view, then focus.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

  const task = currentActiveTask(id);
  if (!task) return;
  scrollTaskIntoView(task.projectId, id);
  focusWhenMounted(id);
};
