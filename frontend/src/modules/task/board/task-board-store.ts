import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useBoardStore } from '~/modules/common/board/board-store';
import { myMembershipsQueryOptions } from '~/modules/me/query';
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
  assigned: string[];
}

const maxRecentSearches = 5;

const withoutSearch = (searches: RecentBoardSearch[], search: RecentBoardSearch) => {
  const key = JSON.stringify(search);
  return searches.filter((other) => JSON.stringify(other) !== key);
};

interface TaskBoardState {
  panelPrefs: Record<string, Record<string, PanelPrefs>>; // boardId → projectId → PanelPrefs
  /** projectId → whether its page shows the header, once the viewer chose on this device. */
  projectHeaderShown: Record<string, boolean>;
  /** Project or workspace id → its recent searches, most recent first. A label belongs to its project, so a search does not carry over. */
  recentSearches: Record<string, RecentBoardSearch[]>;

  saveRecentSearch: (channelId: string, search: RecentBoardSearch) => void;
  removeRecentSearch: (channelId: string, search: RecentBoardSearch) => void;
  setProjectHeaderShown: (projectId: string, shown: boolean) => void;
  setPanelSectionExpanded: (boardId: string, projectId: string, status: TogglableStatusType, expanded: boolean) => void;

  reset: () => void; // Resets in-memory state to initial (call on sign-out)
}

const initStore: Pick<TaskBoardState, 'panelPrefs' | 'projectHeaderShown' | 'recentSearches'> = {
  panelPrefs: {},
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

        setProjectHeaderShown: (projectId, shown) => {
          set((state) => {
            state.projectHeaderShown[projectId] = shown;
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
        version: 5,
        name: 'task-board',
        skipHydration: true,
        storage: createJSONStorage(() => idbKvStorage('task-board')),
        // v1 held split columns, and which bars were unfolded: not worth carrying over. v2 has no recent searches, and before v4 a recent search had no members. Before v5 a project page could choose status panels and their order.
        migrate: (persisted, version) => {
          if (version < 2) return initStore;
          const { statusPanels, startWith, ...state } = persisted as typeof initStore & { statusPanels?: unknown; startWith?: unknown };
          const recentSearches = Object.entries(state.recentSearches ?? {}).map(([channelId, searches]) => [
            channelId,
            searches.map((search) => ({ ...search, assigned: search.assigned ?? [] })),
          ]);
          return { ...state, recentSearches: Object.fromEntries(recentSearches) };
        },
      },
    ),
  ),
);

export { useTaskBoardStore as taskBoardStore };

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
