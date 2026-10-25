import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { create } from 'zustand';

export interface TaskDropLanding {
  edge: Edge;
  taskId: string;
}

interface TaskDropLandingState {
  landing: TaskDropLanding | null;
  setLanding: (landing: TaskDropLanding | null) => void;
}

/** Where a task held over another project's panel, clear of its cards, lands on drop; drawn by the card it lands next to. */
export const useTaskDropLandingStore = create<TaskDropLandingState>()((set) => ({
  landing: null,
  // Set on every drag frame: an unchanged slot keeps the state object, so no card re-renders
  setLanding: (landing) => set((state) => (state.landing?.taskId === landing?.taskId && state.landing?.edge === landing?.edge ? state : { landing })),
}));
