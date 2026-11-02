import { create } from 'zustand';

interface LabelTileState {
  expandedId: string | null;
  expand: (id: string) => void;
  collapse: (id: string) => void;
}

/** The expanded label tile, one at a time: view state like a task card's, so it stays out of the URL. */
export const useLabelTileStore = create<LabelTileState>()((set) => ({
  expandedId: null,
  expand: (id) => set({ expandedId: id }),
  collapse: (id) => set((state) => (state.expandedId === id ? { expandedId: null } : state)),
}));

export { useLabelTileStore as labelTileStore };
