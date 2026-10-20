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
  expand: (id, exclusive) => set((s) => ({ expandedIds: exclusive ? { [id]: true } : { ...s.expandedIds, [id]: true } })),
  collapse: (id) =>
    set((s) => {
      if (!s.expandedIds[id]) return s;
      const { [id]: _, ...rest } = s.expandedIds;
      return { expandedIds: rest };
    }),
}));

/** DOM id of a label tile, so a label link can scroll its tile into view. */
export const labelTileDomId = (labelId: string) => `label-tile-${labelId}`;
