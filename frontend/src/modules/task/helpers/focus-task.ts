import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { currentActiveTask } from '~/modules/task/helpers/active-task';
import { scrollTaskIntoView } from '~/modules/task/helpers/panel-scroll-registry';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';

export const focusTask = (taskId: string | null) => {
  const { focusedTaskId: currentFocused, setFocusedTaskId } = useTaskInteractionStore.getState();
  if (currentFocused) {
    useTaskCardStore.getState().suppressEdit(currentFocused);
  }

  setFocusedTaskId(taskId);
};

// Try to focus a card across a few animation frames, giving virtua time to mount it after scrolling.
/** Focuses a task once virtualization has mounted its card. */
export const focusWhenMounted = (id: string, attemptsLeft = 5) => {
  const taskCard = document.getElementById(id);
  if (taskCard) {
    if (document.activeElement !== taskCard) taskCard.focus();
    return;
  }
  if (attemptsLeft <= 0) return;
  requestAnimationFrame(() => focusWhenMounted(id, attemptsLeft - 1));
};

/** Makes a task the board's current card and scrolls it into view, leaving DOM focus where it is: stepping from the search box. */
export const revealTask = (id: string) => {
  focusTask(id);
  const task = currentActiveTask(id);
  if (task) scrollTaskIntoView(task.projectId, id);
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
