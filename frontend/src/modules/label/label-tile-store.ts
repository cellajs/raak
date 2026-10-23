import { create } from 'zustand';

interface LabelTileState {
  expandedIds: Record<string, true>;
  /** `exclusive` collapses every other tile. */
  expand: (id: string, exclusive?: boolean) => void;
  collapse: (id: string) => void;
}

/** Which label tiles are expanded: view state like a task card's, so it stays out of the URL. */
export const useLabelTileStore = create<LabelTileState>()((set) => ({
  expandedIds: {},
  expand: (id, exclusive) => set((state) => ({ expandedIds: exclusive ? { [id]: true } : { ...state.expandedIds, [id]: true } })),
  collapse: (id) =>
    set((state) => {
      if (!state.expandedIds[id]) return state;
      const { [id]: _, ...rest } = state.expandedIds;
      return { expandedIds: rest };
    }),
}));

export { useLabelTileStore as labelTileStore };
