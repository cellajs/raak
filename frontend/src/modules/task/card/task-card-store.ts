import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { TaskStates } from '~/modules/task/types';

interface TaskStatesState {
  states: Record<string, TaskStates>;
  /** Set a task's view state (collapsed / expanded / editing).
   *  When entering editing, all other editing tasks are demoted to expanded. */
  setTaskState: (taskId: string, state: TaskStates) => void;
  /** Revert an editing task to expanded; keep collapsed tasks collapsed. */
  suppressEdit: (taskId: string) => void;
}

export const useTaskCardStore = create<TaskStatesState>()(
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
            const next = cur === 'collapsed' ? 'collapsed' : ('expanded' as TaskStates);
            if (s.states[taskId] === next) return s;
            return { states: { ...s.states, [taskId]: next } };
          },
          undefined,
          'suppressEdit',
        ),
    }),
    { name: 'task-card' },
  ),
);
