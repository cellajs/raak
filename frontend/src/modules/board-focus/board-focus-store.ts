import { create } from 'zustand';

interface BoardFocusState {
  /** DOM id of the board's current item: a task card, the create-task form or a label tile. One for the whole board. */
  currentItemId: string | null;
  /** The current item while it is mounted: its panel list then leaves the Tab stop to it. */
  mountedItemId: string | null;
  setCurrentItemId: (id: string | null) => void;
  setMountedItemId: (id: string | null) => void;
  reset: () => void;
}

/** The board's current item, shared by every panel kind so the board shows one current item. */
export const useBoardFocusStore = create<BoardFocusState>()((set) => ({
  currentItemId: null,
  mountedItemId: null,
  setCurrentItemId: (currentItemId) => set({ currentItemId }),
  setMountedItemId: (mountedItemId) => set({ mountedItemId }),
  reset: () => set({ currentItemId: null, mountedItemId: null }),
}));

export { useBoardFocusStore as boardFocusStore };
