import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import type { TaskStates } from '~/modules/task/types';

/**
 * Change a task's view state. Handles editing exclusivity (single editor)
 * and the suppressEdit transition used during focus changes.
 *
 * Read-only enforcement is the caller's responsibility — they have access to the
 * `ReadOnlyProjectsContext` via `useIsProjectReadOnly` / `useReadOnlyProjectsRef`.
 */
export function changeTaskState(taskId: string, state: TaskStates | 'suppressEdit') {
  const store = useTaskCardStore.getState();
  if (state === 'suppressEdit') return store.suppressEdit(taskId);
  store.setTaskState(taskId, state);
}
