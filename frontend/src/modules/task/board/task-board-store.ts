import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useBoardStore } from '~/modules/common/board/board-store';
import { myMembershipsQueryOptions } from '~/modules/me/query';
import { statusOptionsByValue, type TaskStatus } from '~/modules/task/task-properties';
import { findMembership } from '~/query/enrichment/helpers';
import { idbKvStorage } from '~/query/idb-kv-storage';

const defaultPanelPrefs = { expandAccepted: false, expandIced: false };

type PanelPrefs = typeof defaultPanelPrefs;
export type TogglableStatusType = 'iced' | 'accepted';

/** A board search as it was made: its words and its filters. */
export interface RecentBoardSearch {
  q: string;
  status: string[];
  type: string[];
  labels: string[];
}

const maxRecentSearches = 5;

const withoutSearch = (searches: RecentBoardSearch[], search: RecentBoardSearch) => {
  const key = JSON.stringify(search);
  return searches.filter((other) => JSON.stringify(other) !== key);
};

interface TaskBoardState {
  panelPrefs: Record<string, Record<string, PanelPrefs>>; // boardId → projectId → PanelPrefs
  /** boardId → statuses with a panel of their own. Only a project page sets them, so a workspace board stays one column per project. */
  statusPanels: Record<string, TaskStatus[]>;
  /** boardId → the status its status panels start with, accepted when absent. Only a project page sets it. */
  startWith: Record<string, TogglableStatusType>;
  /** projectId → whether its page shows the header, once the viewer chose on this device. */
  projectHeaderShown: Record<string, boolean>;
  /** Project or workspace id → its recent searches, most recent first. A label belongs to its project, so a search does not carry over. */
  recentSearches: Record<string, RecentBoardSearch[]>;

  saveRecentSearch: (channelId: string, search: RecentBoardSearch) => void;
  removeRecentSearch: (channelId: string, search: RecentBoardSearch) => void;
  setStartWith: (boardId: string, status: TogglableStatusType) => void;
  setProjectHeaderShown: (projectId: string, shown: boolean) => void;
  toggleStatusPanel: (boardId: string, status: TaskStatus) => void;
  setPanelSectionExpanded: (boardId: string, projectId: string, status: TogglableStatusType, expanded: boolean) => void;

  reset: () => void; // Resets in-memory state to initial (call on sign-out)
}

const initStore: Pick<TaskBoardState, 'panelPrefs' | 'statusPanels' | 'startWith' | 'projectHeaderShown' | 'recentSearches'> = {
  panelPrefs: {},
  statusPanels: {},
  startWith: {},
  projectHeaderShown: {},
  recentSearches: {},
};

export const useTaskBoardStore = create<TaskBoardState>()(
  devtools(
    persist(
      immer((set) => ({
        ...initStore,

        saveRecentSearch: (channelId, search) => {
          set((state) => {
            state.recentSearches[channelId] = [search, ...withoutSearch(state.recentSearches[channelId] ?? [], search)].slice(0, maxRecentSearches);
          });
        },

        removeRecentSearch: (channelId, search) => {
          set((state) => {
            state.recentSearches[channelId] = withoutSearch(state.recentSearches[channelId] ?? [], search);
          });
        },

        setStartWith: (boardId, status) => {
          set((state) => {
            state.startWith[boardId] = status;
          });
        },

        setProjectHeaderShown: (projectId, shown) => {
          set((state) => {
            state.projectHeaderShown[projectId] = shown;
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
        version: 3,
        name: 'task-board',
        skipHydration: true,
        storage: createJSONStorage(() => idbKvStorage('task-board')),
        // v1 held split columns, and which bars were unfolded: not worth carrying over. v2 can hold a panel of the retired Delivered (2).
        migrate: (persisted, version) => {
          if (version < 2) return initStore;
          const state = persisted as typeof initStore;
          const statusPanels = Object.entries(state.statusPanels).map(([boardId, statuses]) => [
            boardId,
            statuses.filter((status) => status in statusOptionsByValue),
          ]);
          return { ...state, statusPanels: Object.fromEntries(statusPanels) };
        },
      },
    ),
  ),
);

export { useTaskBoardStore as taskBoardStore };

/** The status a board's status panels start with. */
export const useStartWith = (boardId: string): TogglableStatusType => useTaskBoardStore((state) => state.startWith[boardId]) ?? 'accepted';

/** Whether a project page shows its header. Until the viewer chooses, only a guest gets it: anyone else comes to work on the board. */
export const useProjectHeaderShown = (projectId: string): boolean => {
  const shown = useTaskBoardStore((state) => state.projectHeaderShown[projectId]);
  const { data: myMemberships } = useQuery(myMembershipsQueryOptions());
  return shown ?? findMembership(myMemberships?.items ?? [], projectId)?.role === 'guest';
};

/** The active board's expand preferences of a project's accepted and iced sections. */
export const useProjectPanelPrefs = (projectId: string) => {
  const boardId = useBoardStore((state) => state.activeBoardId);
  return useTaskBoardStore((state) => (boardId ? state.panelPrefs[boardId]?.[projectId] : undefined)) ?? defaultPanelPrefs;
};
