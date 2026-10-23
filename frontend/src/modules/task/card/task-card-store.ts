import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useBoardFocusStore } from '~/modules/board-focus/board-focus-store';
import type { TaskState } from '~/modules/task/types';

interface TaskCardState {
  states: Record<string, TaskState>;
  /** Set a task's view state (collapsed / expanded / editing).
   *  When entering editing, all other editing tasks are demoted to expanded. */
  setTaskState: (taskId: string, taskState: TaskState) => void;
  /** Revert an editing task to expanded; keep collapsed tasks collapsed. */
  suppressEdit: (taskId: string) => void;
  /** Demote every editing task to expanded (single-editor rule, e.g. when the sheet opens). */
  suppressAllEditing: () => void;
  /** Clear all per-task view state. Call when leaving a workspace/board so the map can't grow forever. */
  reset: () => void;
}

/** Provides access to shared task-card interaction state. */
export const useTaskCardStore = create<TaskCardState>()(
  devtools(
    (set) => ({
      states: {},
      setTaskState: (taskId, taskState) =>
        set(
          (state) => {
            if (state.states[taskId] === taskState) return state;
            const next = { ...state.states, [taskId]: taskState };
            // Enforce single editor: demote all other editing tasks

            if (taskState === 'editing') {
              for (const id in next) {
                if (id !== taskId && next[id] === 'editing') next[id] = 'expanded';
              }
            }
            return { states: next };
          },
          undefined,
          'setTaskState',
        ),
      suppressEdit: (taskId) =>
        set(
          (state) => {
            const current = state.states[taskId] ?? 'collapsed';
            const next: TaskState = current === 'collapsed' ? 'collapsed' : 'expanded';
            if (state.states[taskId] === next) return state;
            return { states: { ...state.states, [taskId]: next } };
          },
          undefined,
          'suppressEdit',
        ),
      suppressAllEditing: () =>
        set(
          (state) => {
            let changed = false;
            const next = { ...state.states };
            for (const id in next) {
              if (next[id] === 'editing') {
                next[id] = 'expanded';
                changed = true;
              }
            }
            return changed ? { states: next } : state;
          },
          undefined,
          'suppressAllEditing',
        ),
      reset: () => set({ states: {} }, undefined, 'reset'),
    }),
    { name: 'task-card' },
  ),
);

// A card stops editing once another board item becomes current, whichever kind of item that is
useBoardFocusStore.subscribe(({ currentItemId }, prev) => {
  if (prev.currentItemId && prev.currentItemId !== currentItemId) useTaskCardStore.getState().suppressEdit(prev.currentItemId);
});

export { useTaskCardStore as taskCardStore };
