import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { create } from 'zustand';

export interface MobileTaskDropIndicator {
  edge: Edge;
  taskId: string;
}

interface MobileTaskDragIndicatorState {
  indicator: MobileTaskDropIndicator | null;
  clearIndicator: () => void;
  setIndicator: (indicator: MobileTaskDropIndicator | null) => void;
}

/** Where the mobile touch-drag drop indicator currently sits (resolved by hit-testing on move). */
export const useMobileTaskDragIndicatorStore = create<MobileTaskDragIndicatorState>()((set) => ({
  indicator: null,
  clearIndicator: () => set({ indicator: null }),
  setIndicator: (indicator) => set({ indicator }),
}));
