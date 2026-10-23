import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { boardStore, useBoardStore } from '~/modules/common/board/board-store';
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

  setPanelSections: (boardId: string, projectId: string, viewSections: SectionsValue[]) => void;
  dropPanelSections: (boardId: string, projectId: string) => void;
  setPanelSectionExpanded: (boardId: string, projectId: string, status: TogglableStatusType, expanded: boolean) => void;

  reset: () => void; // Resets in-memory state to initial (call on sign-out)
}

// Default state values
const initStore: Pick<TaskBoardState, 'panelData'> = { panelData: {} };

const ensureBoard = (state: TaskBoardState, boardId: string) => {
  if (!state.panelData[boardId]) state.panelData[boardId] = {};
  return state.panelData[boardId];
};

const ensurePanel = (board: BoardPanelData, projectId: string) => {
  if (!board[projectId]) board[projectId] = { prefs: { ...defaultPanelPrefs } };
  return board[projectId];
};

/** Provides access to shared task-board state. */
export const useTaskBoardStore = create<TaskBoardState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initStore,

        setPanelSections: (boardId, projectId, viewSections) => {
          // Persist the generic board layout before entering the Immer recipe,
          // since accessing another store during drafting introduces a side effect.
          const currentViewSections = get().panelData[boardId]?.[projectId]?.viewSections;
          const currentLayout = boardStore.getState().boardLayouts[boardId] ?? {};
          const nextLayout = computePanelLayoutSplit(currentLayout, projectId, viewSections, currentViewSections);
          boardStore.getState().updateBoardLayout(boardId, nextLayout);

          set((state) => {
            const board = ensureBoard(state, boardId);
            const panel = ensurePanel(board, projectId);
            panel.viewSections = viewSections;
          });
        },

        dropPanelSections: (boardId, projectId) => {
          set((state) => {
            const board = ensureBoard(state, boardId);
            const panel = ensurePanel(board, projectId);
            delete panel.viewSections;
          });
        },

        setPanelSectionExpanded: (boardId, projectId, status, expanded) => {
          set((state) => {
            const board = ensureBoard(state, boardId);
            const panel = ensurePanel(board, projectId);

            const key = status === 'iced' ? 'expandIced' : 'expandAccepted';
            panel.prefs[key] = expanded;
          });
        },

        reset: () => set(initStore),
      })),
      { version: 1, name: 'task-board', skipHydration: true, storage: createJSONStorage(() => idbKvStorage('task-board')) },
    ),
  ),
);

export { useTaskBoardStore as taskBoardStore };

/** The active board's split sections of a project; undefined while it is unsplit. */
export const useProjectViewSections = (projectId: string) => {
  const boardId = useBoardStore((state) => state.activeBoardId);
  return useTaskBoardStore((state) => (boardId ? state.panelData[boardId]?.[projectId]?.viewSections : undefined));
};

/** The active board's expand preferences of a project's accepted and iced sections. */
export const useProjectPanelPrefs = (projectId: string) => {
  const boardId = useBoardStore((state) => state.activeBoardId);
  return useTaskBoardStore((state) => (boardId ? state.panelData[boardId]?.[projectId]?.prefs : undefined)) ?? defaultPanelPrefs;
};
