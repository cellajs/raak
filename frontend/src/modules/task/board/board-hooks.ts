import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { BoardLayoutPanel } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { normalizePanelWidths, prepareBoardPanels } from '~/modules/task/helpers/board-helpers';
import type { BoardResizablePanel } from '~/modules/task/types';

/** Resolve a panel's displayOrder.
 *  Server-owned (project membership) wins; otherwise fall back to local store. */
export function getPanelDisplayOrder(
  panel: BoardResizablePanel,
  localOrders: Record<string, number> = {},
): number | undefined {
  return panel.project?.membership?.displayOrder ?? localOrders[panel.panelId];
}

/** Sort panels by their resolved displayOrder. Panels without an order keep their
 *  incoming relative position and trail at the end. Pure: returns a new array. */
export function sortPanelsByOrder(
  panels: BoardResizablePanel[],
  localOrders: Record<string, number> = {},
): BoardResizablePanel[] {
  return panels
    .map((panel, idx) => ({ panel, idx, order: getPanelDisplayOrder(panel, localOrders) }))
    .sort((a, b) => {
      if (a.order === undefined && b.order === undefined) return a.idx - b.idx;
      if (a.order === undefined) return 1;
      if (b.order === undefined) return -1;
      return a.order - b.order;
    })
    .map(({ panel }) => panel);
}

/** Shared board panel setup: panels, layout, and resize handler. */
export function useBoardPanels(boardId: string, projects: EnrichedProject[], extraPanels?: BoardResizablePanel[]) {
  const panelInfo = useTaskBoardStore(useShallow((state) => state.panelData[boardId]));
  const storedBoardLayout = useBoardStore((state) => state.boardLayouts[boardId]);
  const localOrders = useBoardStore((state) => state.boardPanelOrders[boardId]);
  const prunePanelOrders = useBoardStore((state) => state.prunePanelOrders);
  const updateBoardLayout = useBoardStore((state) => state.updateBoardLayout);

  const panels: BoardResizablePanel[] = useMemo(() => {
    const all = [...prepareBoardPanels(projects, panelInfo), ...(extraPanels ?? [])];
    return sortPanelsByOrder(all, localOrders);
  }, [projects, extraPanels, panelInfo, localOrders]);

  // Drop stale local orders once their panels disappear
  useEffect(() => {
    prunePanelOrders(
      boardId,
      panels.map((p) => p.panelId),
    );
  }, [boardId, panels, prunePanelOrders]);

  const layoutPanels: BoardLayoutPanel[] = useMemo(() => panels.map(({ panelId }) => ({ panelId })), [panels]);

  const defaultLayout = useMemo(
    () =>
      normalizePanelWidths(
        storedBoardLayout ?? {},
        panels.map(({ panelId }) => panelId),
      ),
    [storedBoardLayout, panels],
  );

  const handleLayoutChanged = useCallback(
    (layout: Record<string, number>) => {
      updateBoardLayout(boardId, layout);
    },
    [boardId, updateBoardLayout],
  );

  return { panels, layoutPanels, defaultLayout, handleLayoutChanged };
}
