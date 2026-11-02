import { create } from 'zustand';
import { prefersMoreContrast } from '~/hooks/use-more-contrast';

interface WorkspaceArrivalState {
  /** The project "Open in workspace" just restored onto this board. */
  projectId: string | null;
  setArrival: (projectId: string) => void;
  clearArrival: () => void;
}

const undoWindow = 10_000;

let expiry: ReturnType<typeof setTimeout> | undefined;

/** Kept out of the URL so a reload or a shared link never replays the balloon. */
export const useWorkspaceArrivalStore = create<WorkspaceArrivalState>()((set) => ({
  projectId: null,
  setArrival: (projectId) => {
    clearTimeout(expiry);
    set({ projectId });
    // Increased contrast overrules timeouts, as it does for toasts
    if (!prefersMoreContrast()) expiry = setTimeout(() => set({ projectId: null }), undoWindow);
  },
  clearArrival: () => {
    clearTimeout(expiry);
    set({ projectId: null });
  },
}));
