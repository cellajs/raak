import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { create } from 'zustand';

export interface MobileTaskDragIndicator {
  edge: Edge;
  taskId: string;
}

interface MobileTaskDragIndicatorState {
  indicator: MobileTaskDragIndicator | null;
  setIndicator: (indicator: MobileTaskDragIndicator | null) => void;
}

/** The mobile touch-drag drop indicator, set by hit-testing on move. */
export const useMobileTaskDragIndicatorStore = create<MobileTaskDragIndicatorState>()((set) => ({
  indicator: null,
  setIndicator: (indicator) => set({ indicator }),
}));

export { useMobileTaskDragIndicatorStore as mobileTaskDragIndicatorStore };
