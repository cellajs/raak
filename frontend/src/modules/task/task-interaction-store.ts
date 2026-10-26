import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Task } from '~/modules/task/types';

interface TaskInteractionState {
  /** Ids of tasks selected on the board or table; entities resolve from the query cache at action time. */
  selectedTaskIds: string[];
  /** Project of the selected tasks, kept when a later selection passes none; null once the selection is empty. */
  selectedProjectId: string | null;
  setSelectedTaskIds: (ids: string[], projectId?: string) => void;
  /** Keyed by projectId: a project's create form is open iff it has a draft here. */
  draftTasks: Record<string, Task>;
  setDraftTask: (projectId: string, task: Task | null) => void;
  updateDraftTask: (projectId: string, updates: Partial<Task>) => void;
  /** Call when leaving a workspace or board context. */
  reset: () => void;
}

const initialState: Pick<TaskInteractionState, 'selectedTaskIds' | 'selectedProjectId' | 'draftTasks'> = {
  selectedTaskIds: [],
  selectedProjectId: null,
  draftTasks: {},
};

/** Task selection and open create forms across the board; the current item lives in `useBoardFocusStore`. */
export const useTaskInteractionStore = create<TaskInteractionState>()(
  devtools(
    immer((set) => ({
      ...initialState,
      setSelectedTaskIds: (ids, projectId) => {
        set((state) => {
          state.selectedTaskIds = ids;
          state.selectedProjectId = ids.length ? (projectId ?? state.selectedProjectId) : null;
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

export { useTaskInteractionStore as taskInteractionStore };
