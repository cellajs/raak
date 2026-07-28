import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useBoardStore } from '~/modules/common/board/board-store';
import { computePanelLayoutSplit } from '~/modules/task/helpers/board-helpers';
import type { Task } from '~/modules/task/types';
import { idbKvStorage } from '~/query/idb-kv-storage';

/** Defines the initial board panel preferences. */
export const defaultPanelPrefs = { expandAccepted: false, expandIced: false };

type PanelPrefs = typeof defaultPanelPrefs;
export type SectionsValue = Record<'status', Task['status'][]>;
export type TogglableStatusType = 'iced' | 'accepted';

/** One board's panel data: projectId → panel info. */
export type BoardPanelData = Record<string, { viewSections?: SectionsValue[]; prefs: PanelPrefs }>;

interface TaskBoardState {
  panelData: Record<string, BoardPanelData>; // boardId → BoardPanelData

  setPanelSections: (boardId: string, projectId: string, sections: SectionsValue[]) => void;
  dropPanelSections: (boardId: string, projectId: string) => void;
  togglePanelSectionExpandState: (
    boardId: string,
    projectId: string,
    status: TogglableStatusType,
    newState?: boolean,
  ) => void;

  reset: () => void; // Resets in-memory state to initial (call on sign-out)
}

// Default state values
const initStore: Pick<TaskBoardState, 'panelData'> = {
  panelData: {},
};

const ensureBoard = (state: TaskBoardState, boardId: string) => {
  if (!state.panelData[boardId]) state.panelData[boardId] = {};
  return state.panelData[boardId];
};

const ensurePanel = (board: TaskBoardState['panelData'][string], projectId: string) => {
  if (!board[projectId]) board[projectId] = { prefs: { ...defaultPanelPrefs } };
  return board[projectId];
};

/** Provides access to shared task-board state. */
export const useTaskBoardStore = create<TaskBoardState>()(
  devtools(
    persist(
      immer((set) => ({
        ...initStore,

        setPanelSections: (boardId, projectId, sections) => {
          // Persist the generic board layout before entering the Immer recipe,
          // since accessing another store during drafting introduces a side effect.
          const currentViewSections = useTaskBoardStore.getState().panelData[boardId]?.[projectId]?.viewSections;
          const currentLayout = useBoardStore.getState().boardLayouts[boardId] ?? {};
          const nextLayout = computePanelLayoutSplit(currentLayout, projectId, sections, currentViewSections);
          useBoardStore.getState().updateBoardLayout(boardId, nextLayout);

          set((state) => {
            const board = ensureBoard(state, boardId);
            const panel = ensurePanel(board, projectId);
            panel.viewSections = sections;
          });
        },

        dropPanelSections: (boardId, projectId) => {
          set((state) => {
            const board = ensureBoard(state, boardId);
            const panel = ensurePanel(board, projectId);
            delete panel.viewSections;
          });
        },

        togglePanelSectionExpandState: (boardId, projectId, status, newState) => {
          set((state) => {
            const board = ensureBoard(state, boardId);
            const panel = ensurePanel(board, projectId);

            const current = status === 'iced' ? panel.prefs.expandIced : panel.prefs.expandAccepted;
            if (typeof newState === 'boolean' && newState === current) return;

            const next = typeof newState === 'boolean' ? newState : !current;
            if (status === 'iced') panel.prefs.expandIced = next;
            else panel.prefs.expandAccepted = next;
          });
        },

        reset: () => set(initStore),
      })),
      {
        version: 1,
        name: 'task-board',
        skipHydration: true,
        storage: createJSONStorage(() => idbKvStorage('task-board')),
      },
    ),
  ),
);
