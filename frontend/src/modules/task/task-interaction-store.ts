import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Task } from '~/modules/task/types';

interface TaskInteractionState {
  /** Ids of tasks selected on the board or table; entities resolve from the query cache at action time. */
  selectedTaskIds: string[];
  setSelectedTaskIds: (ids: string[]) => void;
  /**
   * Ids of label rows selected in the labels panel. Task and label selection are mutually exclusive
   * (checkboxes of the other kind disable), so the board header's remove button acts on one kind.
   */
  selectedLabelIds: string[];
  setSelectedLabelIds: (ids: string[]) => void;
  focusedTaskId: string | null;
  setFocusedTaskId: (taskId: string | null) => void;
  /**
   * Draft tasks keyed by projectId for inline create-form placeholders. A project's create form
   * is open iff it has a draft here, so consumers derive open-ness from `draftTasks[projectId]`.
   */
  draftTasks: Record<string, Task>;
  setDraftTask: (projectId: string, task: Task | null) => void;
  updateDraftTask: (projectId: string, updates: Partial<Task>) => void;
  /** Reset all interaction state. Call when leaving a workspace/board context. */
  reset: () => void;
}

const initialState: Pick<
  TaskInteractionState,
  'selectedTaskIds' | 'selectedLabelIds' | 'focusedTaskId' | 'draftTasks'
> = {
  selectedTaskIds: [],
  selectedLabelIds: [],
  focusedTaskId: null,
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
      setSelectedTaskIds: (ids) => {
        set((state) => {
          state.selectedTaskIds = ids;
        });
      },
      setSelectedLabelIds: (ids) => {
        set((state) => {
          state.selectedLabelIds = ids;
        });
      },
      setFocusedTaskId: (id) => {
        set((state) => {
          state.focusedTaskId = id;
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
