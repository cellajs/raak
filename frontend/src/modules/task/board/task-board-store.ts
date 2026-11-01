import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useBoardStore } from '~/modules/common/board/board-store';
import type { TaskStatus } from '~/modules/task/task-properties';
import { idbKvStorage } from '~/query/idb-kv-storage';

const defaultPanelPrefs = { expandAccepted: false, expandIced: false };

type PanelPrefs = typeof defaultPanelPrefs;
export type TogglableStatusType = 'iced' | 'accepted';

interface TaskBoardState {
  panelPrefs: Record<string, Record<string, PanelPrefs>>; // boardId → projectId → PanelPrefs
  /** boardId → statuses with a panel of their own. Only a project page sets them, so a workspace board stays one column per project. */
  statusPanels: Record<string, TaskStatus[]>;
  /** boardId → the status its status panels start with, accepted when absent. Only a project page sets it. */
  startWith: Record<string, TogglableStatusType>;

  setStartWith: (boardId: string, status: TogglableStatusType) => void;
  toggleStatusPanel: (boardId: string, status: TaskStatus) => void;
  setPanelSectionExpanded: (boardId: string, projectId: string, status: TogglableStatusType, expanded: boolean) => void;

  reset: () => void; // Resets in-memory state to initial (call on sign-out)
}

const initStore: Pick<TaskBoardState, 'panelPrefs' | 'statusPanels' | 'startWith'> = { panelPrefs: {}, statusPanels: {}, startWith: {} };

export const useTaskBoardStore = create<TaskBoardState>()(
  devtools(
    persist(
      immer((set) => ({
        ...initStore,

        setStartWith: (boardId, status) => {
          set((state) => {
            state.startWith[boardId] = status;
          });
        },

        toggleStatusPanel: (boardId, status) => {
          set((state) => {
            const statuses = state.statusPanels[boardId] ?? [];
            state.statusPanels[boardId] = statuses.includes(status) ? statuses.filter((other) => other !== status) : [...statuses, status];
          });
        },

        setPanelSectionExpanded: (boardId, projectId, status, expanded) => {
          set((state) => {
            state.panelPrefs[boardId] ??= {};
            state.panelPrefs[boardId][projectId] ??= { ...defaultPanelPrefs };

            const key = status === 'iced' ? 'expandIced' : 'expandAccepted';
            state.panelPrefs[boardId][projectId][key] = expanded;
          });
        },

        reset: () => set(initStore),
      })),
      {
        version: 2,
        name: 'task-board',
        skipHydration: true,
        storage: createJSONStorage(() => idbKvStorage('task-board')),
        // v1 held split columns, and which bars were unfolded: not worth carrying over
        migrate: () => initStore,
      },
    ),
  ),
);

export { useTaskBoardStore as taskBoardStore };

/** The status a board's status panels start with. */
export const useStartWith = (boardId: string): TogglableStatusType => useTaskBoardStore((state) => state.startWith[boardId]) ?? 'accepted';

/** The active board's expand preferences of a project's accepted and iced sections. */
export const useProjectPanelPrefs = (projectId: string) => {
  const boardId = useBoardStore((state) => state.activeBoardId);
  return useTaskBoardStore((state) => (boardId ? state.panelPrefs[boardId]?.[projectId] : undefined)) ?? defaultPanelPrefs;
};
