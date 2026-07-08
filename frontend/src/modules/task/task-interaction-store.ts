import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Task } from '~/modules/task/types';

interface TaskInteractionState {
  selectedTasks: Task[];
  setSelectedTasks: (tasks: Task[]) => void;
  focusedTaskId: string | null;
  setFocusedTaskId: (taskId: string | null) => void;
  openCreateForms: string[];
  toggleCreateForm: (projectId: string) => void;
  /** Draft tasks keyed by projectId for inline create-form placeholders. */
  draftTasks: Record<string, Task>;
  setDraftTask: (projectId: string, task: Task | null) => void;
  updateDraftTask: (projectId: string, updates: Partial<Task>) => void;
  /** Reset all interaction state. Call when leaving a workspace/board context. */
  reset: () => void;
}

const initialState: Pick<TaskInteractionState, 'selectedTasks' | 'focusedTaskId' | 'openCreateForms' | 'draftTasks'> = {
  selectedTasks: [],
  focusedTaskId: null,
  openCreateForms: [],
  draftTasks: {},
};

/**
 * Store to manage task interactions such as selection, focus, and open create forms across the task board.
 * This allows for consistent state management and avoids prop drilling for these common interactions.
 */
export const useTaskInteractionStore = create<TaskInteractionState>()(
  devtools(
    immer((set) => ({
      ...initialState,
      setSelectedTasks: (tasks) => {
        set((state) => {
          state.selectedTasks = tasks;
        });
      },
      setFocusedTaskId: (id) => {
        set((state) => {
          state.focusedTaskId = id;
        });
      },
      toggleCreateForm: (projectId) => {
        set((state) => {
          const idx = state.openCreateForms.indexOf(projectId);
          if (idx >= 0) {
            state.openCreateForms.splice(idx, 1);
          } else {
            state.openCreateForms.push(projectId);
          }
        });
      },
      setDraftTask: (projectId, task) => {
        set((state) => {
          if (task) state.draftTasks[projectId] = task;
          else delete state.draftTasks[projectId];
        });
      },
      updateDraftTask: (projectId, updates) => {
        set((state) => {
          const draft = state.draftTasks[projectId];
          if (draft) Object.assign(draft, updates);
        });
      },
      reset: () => {
        set((state) => {
          Object.assign(state, initialState);
        });
      },
    })),
  ),
);
