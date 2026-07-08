import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TaskState } from '~/modules/task/types';

interface TaskCardState {
  states: Record<string, TaskState>;
  /** Set a task's view state (collapsed / expanded / editing).
   *  When entering editing, all other editing tasks are demoted to expanded. */
  setTaskState: (taskId: string, state: TaskState) => void;
  /** Revert an editing task to expanded; keep collapsed tasks collapsed. */
  suppressEdit: (taskId: string) => void;
  /** Clear all per-task view state. Call when leaving a workspace/board so the map can't grow forever. */
  reset: () => void;
}

export const useTaskCardStore = create<TaskCardState>()(
  devtools(
    (set) => ({
      states: {},
      setTaskState: (taskId, state) =>
        set(
          (s) => {
            if (s.states[taskId] === state) return s;
            const next = { ...s.states, [taskId]: state };
            // Enforce single editor: demote all other editing tasks

            if (state === 'editing') {
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
          (s) => {
            const cur = s.states[taskId] ?? 'collapsed';
            const next = cur === 'collapsed' ? 'collapsed' : ('expanded' as TaskState);
            if (s.states[taskId] === next) return s;
            return { states: { ...s.states, [taskId]: next } };
          },
          undefined,
          'suppressEdit',
        ),
      reset: () => set({ states: {} }, undefined, 'reset'),
    }),
    { name: 'task-card' },
  ),
);
