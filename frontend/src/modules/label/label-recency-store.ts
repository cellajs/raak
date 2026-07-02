import { appConfig } from 'shared';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { isDebugMode } from '~/env';

const maxEntries = 200;

interface LabelRecencyState {
  usageMap: Record<string, number>; // "orgId:labelName" → epoch ms
  trackUsage: (organizationId: string, names: string[]) => void;
  getScore: (organizationId: string, name: string) => number;
  clear: () => void;
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
      }),
      {
        name: `${appConfig.slug}-label-recency`,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ usageMap: state.usageMap }),
      },
    ),
    { enabled: isDebugMode, name: 'label recency store' },
  ),
);

export { useLabelRecencyStore as labelRecencyStore };
