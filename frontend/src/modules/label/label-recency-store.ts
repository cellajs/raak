import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { isDebugMode } from '~/env';
import { idbKvStorage } from '~/query/idb-kv-storage';

const maxEntries = 200;

interface LabelRecencyState {
  // Keyed by SLUG: the picker suggests across the cross-project slug group, so recency tracks the
  // group identity (stable across renames) rather than a per-project row id or display name.
  usageMap: Record<string, number>; // "orgId:labelSlug" → epoch ms
  trackUsage: (organizationId: string, slugs: string[]) => void;
  getScore: (organizationId: string, slug: string) => number;
  clear: () => void;
  reset: () => void; // Resets in-memory state to initial (call on sign-out)
}

export const useLabelRecencyStore = create<LabelRecencyState>()(
  devtools(
    persist(
      (set, get) => ({
        usageMap: {},
        trackUsage: (organizationId, slugs) =>
          set((state) => {
            const now = Date.now();
            const updated = { ...state.usageMap };
            for (const slug of slugs) updated[`${organizationId}:${slug}`] = now;
            // Evict oldest beyond cap
            const entries = Object.entries(updated);
            if (entries.length > maxEntries) {
              entries.sort((a, b) => b[1] - a[1]);
              return { usageMap: Object.fromEntries(entries.slice(0, maxEntries)) };
            }
            return { usageMap: updated };
          }),
        getScore: (organizationId, slug) => get().usageMap[`${organizationId}:${slug}`] ?? 0,
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
