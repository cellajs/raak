import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { isDebugMode } from '~/env';
import { idbKvStorage } from '~/query/idb-kv-storage';

const maxEntries = 200;

interface LabelRecencyState {
  // Keyed by NAME, not slug/id: the picker suggests across the cross-project name group,
  // and it only serves secondary labels (whose create-on-type names are slug-shaped anyway).
  usageMap: Record<string, number>; // "orgId:labelName" → epoch ms
  trackUsage: (organizationId: string, names: string[]) => void;
  getScore: (organizationId: string, name: string) => number;
  clear: () => void;
  reset: () => void; // Resets in-memory state to initial (call on sign-out)
}

export const useLabelRecencyStore = create<LabelRecencyState>()(
  devtools(
    persist(
      (set, get) => ({
        usageMap: {},
        trackUsage: (organizationId, names) =>
          set((state) => {
            const now = Date.now();
            const updated = { ...state.usageMap };
            for (const name of names) updated[`${organizationId}:${name}`] = now;
            // Evict oldest beyond cap
            const entries = Object.entries(updated);
            if (entries.length > maxEntries) {
              entries.sort((a, b) => b[1] - a[1]);
              return { usageMap: Object.fromEntries(entries.slice(0, maxEntries)) };
            }
            return { usageMap: updated };
          }),
        getScore: (organizationId, name) => get().usageMap[`${organizationId}:${name}`] ?? 0,
        clear: () => set({ usageMap: {} }),
        reset: () => set({ usageMap: {} }),
      }),
      {
        name: 'label-recency',
        skipHydration: true,
        storage: createJSONStorage(() => idbKvStorage('label-recency')),
        partialize: (state) => ({ usageMap: state.usageMap }),
      },
    ),
    { enabled: isDebugMode, name: 'label recency store' },
  ),
);

export { useLabelRecencyStore as labelRecencyStore };
