import type { ContextEntity } from 'backend/types/common';
import { config } from 'config';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { menuSections } from '~/nav-config';

import type { UserMenu, UserMenuItem } from '~/types/common';
import { objectKeys } from '~/utils/object';

type EntitySubList = Record<string, string[]>;
export type EntityConfig = Record<ContextEntity, { mainList: string[]; subList: EntitySubList }>;

interface NavigationState {
  recentSearches: string[];
  setRecentSearches: (searchValue: string[]) => void;
  menu: UserMenu;
  navSheetOpen: string | null;
  setNavSheetOpen: (sheet: string | null) => void;
  keepMenuOpen: boolean;
  setKeepMenuOpen: (status: boolean) => void;
  keepOpenPreference: boolean;
  toggleKeepOpenPreference: (status: boolean) => void;
  hideSubmenu: boolean;
  toggleHideSubmenu: (status: boolean) => void;
  activeSections: Record<string, boolean> | null;
  toggleSection: (section: string) => void;
  setSectionsDefault: () => void;
  navLoading: boolean;
  setLoading: (status: boolean) => void;
  focusView: boolean;
  setFocusView: (status: boolean) => void;
  archiveStateToggle: (item: UserMenuItem, active: boolean, parentId?: string | null) => void;
  finishedOnboarding: boolean;
  setFinishedOnboarding: () => void;
  clearNavigationStore: () => void;
}

interface InitStore
  extends Pick<
    NavigationState,
    | 'recentSearches'
    | 'keepMenuOpen'
    | 'hideSubmenu'
    | 'navLoading'
    | 'focusView'
    | 'menu'
    | 'activeSections'
    | 'finishedOnboarding'
    | 'navSheetOpen'
    | 'keepOpenPreference'
  > {}

const initialMenuState: UserMenu = menuSections
  .filter((el) => !el.isSubmenu)
  .reduce((acc, section) => {
    acc[section.storageType] = [];
    return acc;
  }, {} as UserMenu);

const initStore: InitStore = {
  recentSearches: [],
  navSheetOpen: null,
  keepMenuOpen: window.innerWidth > 1280,
  keepOpenPreference: false,
  hideSubmenu: false,
  navLoading: false,
  focusView: false,
  menu: initialMenuState,
  activeSections: null,
  finishedOnboarding: false,
};

export const useNavigationStore = create<NavigationState>()(
  devtools(
    immer(
      persist(
        (set) => ({
          ...initStore,
          setNavSheetOpen: (sheet) => {
            set((state) => {
              state.navSheetOpen = sheet;
            });
          },
          setRecentSearches: (searchValues: string[]) => {
            set((state) => {
              state.recentSearches = searchValues;
            });
          },
          setKeepMenuOpen: (status) => {
            set((state) => {
              state.keepMenuOpen = status;
            });
          },
          toggleKeepOpenPreference: (status) => {
            set((state) => {
              state.keepOpenPreference = status;
            });
          },
          toggleHideSubmenu: (status) => {
            set((state) => {
              state.hideSubmenu = status;
            });
          },
          setLoading: (status) => {
            set((state) => {
              state.navLoading = status;
            });
          },
          setFocusView: (status) => {
            set((state) => {
              state.focusView = status;
            });
          },
          toggleSection: (section) => {
            set((state) => {
              if (!state.activeSections) state.activeSections = { [section]: false };
              else if (state.activeSections[section] !== undefined) state.activeSections[section] = !state.activeSections[section];
              else state.activeSections = { ...state.activeSections, ...{ [section]: false } };
            });
          },
          setSectionsDefault: () => {
            set((state) => {
              state.activeSections = null;
            });
          },
          archiveStateToggle: (item: UserMenuItem, active: boolean, parentId?: string | null) => {
            set((state) => {
              if (!parentId) {
                // Update the 'archived' status for the item in all sections
                for (const sectionKey of objectKeys(state.menu)) {
                  const section = state.menu[sectionKey];
                  const itemIndex = section.findIndex((el) => el.id === item.id);
                  if (itemIndex !== -1) state.menu[sectionKey][itemIndex].membership.archived = active;
                }
              } else {
                // Update the 'archived' status for the item in a specific submenu
                const section = menuSections.find((el) => el.type === item.entity)?.storageType;
                if (!section) return;
                const parent = state.menu[section].find((item) => item.id === parentId);
                if (!parent || !parent.submenu) return;
                const itemIndex = parent.submenu.findIndex((el) => el.id === item.id);
                if (itemIndex && itemIndex !== -1) parent.submenu[itemIndex].membership.archived = active;
              }
            });
          },
          setFinishedOnboarding: () => {
            set((state) => {
              state.finishedOnboarding = true;
            });
          },
          clearNavigationStore: () =>
            set((state) => ({
              ...state,
              ...initStore,
            })),
        }),
        {
          version: 6,
          name: `${config.slug}-navigation`,
          partialize: (state) => ({
            menu: state.menu,
            keepOpenPreference: state.keepOpenPreference,
            hideSubmenu: state.hideSubmenu,
            activeSections: state.activeSections,
            recentSearches: state.recentSearches,
            finishedOnboarding: state.finishedOnboarding,
          }),
          storage: createJSONStorage(() => localStorage),
        },
      ),
    ),
  ),
);
