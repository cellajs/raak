import { appConfig } from 'shared';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useBoardStore } from '~/modules/common/board/board-store';
import { makePanelKey } from '~/modules/task/helpers/board-helpers';
import type { Task } from '~/modules/task/types';

export const defaultPanelPrefs = { expandAccepted: false, expandIced: false };

type PanelPrefs = typeof defaultPanelPrefs;
export type SectionsValue = Record<'status', Task['status'][]>;
export type TogglabelStatusTypes = 'iced' | 'accepted';

interface TaskBoardState {
  panelData: Record<
    string, // boardId
    Record<string, { viewSections?: SectionsValue[]; prefs: PanelPrefs }> // projectId => panel info
  >;

  setPanelSections: (boardId: string, projectId: string, sections: SectionsValue[]) => void;
  dropPanelSections: (boardId: string, projectId: string) => void;
  togglePanelSectionExpandState: (
    boardId: string,
    projectId: string,
    status: TogglabelStatusTypes,
    newState?: boolean,
  ) => void;
}

const ensureBoard = (state: TaskBoardState, boardId: string) => {
  if (!state.panelData[boardId]) state.panelData[boardId] = {};
  return state.panelData[boardId];
};

const ensurePanel = (board: TaskBoardState['panelData'][string], projectId: string) => {
  if (!board[projectId]) board[projectId] = { prefs: { ...defaultPanelPrefs } };
  return board[projectId];
};

export const useTaskBoardStore = create<TaskBoardState>()(
  devtools(
    persist(
      immer((set) => ({
        panelData: {},

        setPanelSections: (boardId, projectId, sections) => {
          set((state) => {
            const board = ensureBoard(state, boardId);
            const panel = ensurePanel(board, projectId);
            const viewSections = panel.viewSections;

            // Also update layout in the generic board-store store
            const baseBoardState = useBoardStore.getState();
            const layout = { ...(baseBoardState.boardLayouts[boardId] ?? {}) };
            const layoutArray = Object.entries(layout);

            if (!viewSections) {
              const insertIndex = layoutArray.findIndex(([key]) => key.includes(projectId));
              const totalSize = layoutArray.reduce(
                (sum, [key, size]) => (key.includes(projectId) ? sum + size : sum),
                0,
              );
              const filtered = layoutArray.filter(([key]) => !key.includes(projectId));
              filtered.splice(insertIndex, 0, [projectId, totalSize]);
              useBoardStore.getState().updateBoardLayout(boardId, Object.fromEntries(filtered));
            } else {
              const updated = layoutArray.flatMap(([key, size]) => {
                if (!key.includes(projectId)) return [[key, size]];
                const percentagePart = size / viewSections.length;
                return sections.map((sectionFilters) => [makePanelKey(projectId, sectionFilters), percentagePart]);
              });
              useBoardStore.getState().updateBoardLayout(boardId, Object.fromEntries(updated));
            }

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
      })),
      {
        version: 1,
        name: `${appConfig.slug}-task-board`,
        storage: createJSONStorage(() => localStorage),
      },
    ),
  ),
);
