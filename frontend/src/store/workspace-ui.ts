import { config } from 'config';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Label } from '~/types/app';

export type Column = {
  columnId: string;
  createTaskForm: boolean;
  expandAccepted: boolean;
  expandIced: boolean;
  recentLabels: Label[];
  taskIds: string[];
};

type WorkspaceUIById = {
  [workspaceId: string]: {
    panel: string;
    columns: { [columnId: string]: Column };
  };
};

export const defaultColumnValues = {
  createTaskForm: false,
  expandAccepted: false,
  expandIced: false,
  recentLabels: [] as Label[],
  taskIds: [] as string[],
};

interface WorkspaceUIState {
  workspaces: WorkspaceUIById;
  changePanels: (workspaceId: string, panels: string) => void;
  addNewColumn: (workspaceId: string, columnId: string, column: Column) => void;
  changeColumn: (workspaceId: string, columnId: string, column: Partial<Column>) => void;
}

export const useWorkspaceUIStore = create<WorkspaceUIState>()(
  devtools(
    persist(
      immer((set) => ({
        workspaces: {},
        workspacesPanels: {},
        addNewColumn: (workspaceId: string, columnId: string, column: Column) => {
          set((state) => {
            if (!state.workspaces[workspaceId]) {
              // Initialize the workspace if it doesn't exist
              state.workspaces[workspaceId] = { panel: '', columns: {} };
            }
            state.workspaces[workspaceId].columns[columnId] = { ...defaultColumnValues, ...column };
          });
        },
        // Modify an existing column or add it if it doesn't exist
        changeColumn: (workspaceId: string, columnId: string, newColumn: Partial<Column>) => {
          set((state) => {
            if (!state.workspaces[workspaceId]) {
              // Initialize the workspace if it doesn't exist
              state.workspaces[workspaceId] = { panel: '', columns: {} };
            }
            if (!state.workspaces[workspaceId].columns[columnId]) {
              // Add a new column if it doesn't exist
              state.workspaces[workspaceId].columns[columnId] = { ...defaultColumnValues, columnId };
            }
            // Update the existing column with new values
            state.workspaces[workspaceId].columns[columnId] = {
              ...state.workspaces[workspaceId].columns[columnId],
              ...newColumn,
            };
          });
        },
        changePanels: (workspaceId: string, panel: string) => {
          set((state) => {
            // Initialize the workspace if it doesn't exist
            if (!state.workspaces[workspaceId]) state.workspaces[workspaceId] = { panel: '', columns: {} };
            state.workspaces[workspaceId].panel = panel;
          });
        },
      })),

      {
        version: 4,
        name: `${config.slug}-workspace-ui`,
        partialize: (state) => ({
          workspaces: state.workspaces,
        }),
        storage: createJSONStorage(() => localStorage),
      },
    ),
  ),
);
