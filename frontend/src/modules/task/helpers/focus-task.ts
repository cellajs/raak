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

// One slot: a later keypress overwrites it, so an item that mounts late never takes focus from a newer one.
let pendingFocusId: string | null = null;

// virtua keeps a freshly mounted row hidden until it has measured it, and a hidden element ignores focus()
const focusOnceVisible = (id: string, item: HTMLElement) => {
  if (pendingFocusId !== id || !item.isConnected) return;
  if (useTaskInteractionStore.getState().focusedTaskId !== id) {
    pendingFocusId = null;
    return;
  }
  item.focus();
  if (document.activeElement === item) pendingFocusId = null;
  else requestAnimationFrame(() => focusOnceVisible(id, item));
};

/** Focuses a task card or create form now, or as it mounts when virtualization or loading still holds it back. */
export const focusWhenMounted = (id: string) => {
  pendingFocusId = id;
  const item = document.getElementById(id);
  if (item) focusOnceVisible(id, item);
};

/** Called by a board item as it mounts, to take the focus left for it while it was not mounted. */
export const takePendingFocus = (id: string, item: HTMLElement | null) => {
  if (item && pendingFocusId === id) focusOnceVisible(id, item);
};

/** Records the current item as mounted. Returns the cleanup that clears it, unless a newer item took its place. */
export const markCurrentItemMounted = (id: string) => {
  useTaskInteractionStore.getState().setMountedFocusId(id);
  return () => {
    const { mountedFocusId, setMountedFocusId } = useTaskInteractionStore.getState();
    if (mountedFocusId === id) setMountedFocusId(null);
  };
};

/** Makes a task the board's current card and scrolls it into view, leaving DOM focus where it is: stepping from the search box. */
export const revealTask = (id: string) => {
  focusTask(id);
  const task = currentActiveTask(id);
  if (task) scrollTaskIntoView(task.projectId, id);
};

/** Makes a task card or the create form current and focuses it, scrolling it into view first when virtualized out. */
export const setTaskCardFocus = (id: string) => {
  focusTask(id);

  if (!document.getElementById(id)) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const task = currentActiveTask(id);
    if (task) scrollTaskIntoView(task.projectId, id);
  }
  focusWhenMounted(id);
};
