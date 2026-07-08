import { useCallback, useEffect, useMemo } from 'react';
import { getOrderBetween } from 'shared/utils/display-order';
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
  const membershipOrder = panel.kind === 'project' ? panel.project.membership?.displayOrder : undefined;
  return membershipOrder ?? localOrders[panel.panelId];
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

/** What a panel drag-reorder should persist: a server-owned membership update, a local-only
 *  panel order, or nothing (null) when the drop is a no-op. */
export type PanelReorderResult =
  | {
      kind: 'membership';
      membershipId: string;
      tenantId: string;
      organizationId: string;
      projectId: string;
      displayOrder: number;
    }
  | { kind: 'local'; panelId: string; displayOrder: number }
  | null;

/**
 * Pure fractional-order computation for a panel drag-reorder. Resolves neighbor orders via the
 * same comparator used to render, so server-owned and local-only panels reorder uniformly.
 * Returns null (skip) for: unknown source, single panel (no anchor), float collision, or an
 * unchanged membership order. The caller performs the actual persistence.
 */
export function computePanelReorder(
  panels: BoardResizablePanel[],
  localOrders: Record<string, number> | undefined,
  newOrder: string[],
  sourcePanelId: string,
): PanelReorderResult {
  const sourcePanel = panels.find((p) => p.panelId === sourcePanelId);
  if (!sourcePanel) return null;

  const panelById = new Map(panels.map((p) => [p.panelId, p]));
  const orderAt = (i: number): number | undefined => {
    if (i < 0 || i >= newOrder.length) return undefined;
    const neighbor = panelById.get(newOrder[i]);
    return neighbor ? getPanelDisplayOrder(neighbor, localOrders) : undefined;
  };

  const sourceIdx = newOrder.indexOf(sourcePanelId);
  const prevOrder = orderAt(sourceIdx - 1);
  const nextOrder = orderAt(sourceIdx + 1);

  // Single panel — no anchor to reorder against.
  if (prevOrder == null && nextOrder == null) return null;

  const newDisplayOrder = getOrderBetween(prevOrder ?? undefined, nextOrder ?? undefined);
  // Float collision — skip; a rebalance pass would be needed to recover.
  if (newDisplayOrder === null) return null;

  const sourceProject = sourcePanel.kind === 'project' ? sourcePanel.project : undefined;
  if (sourceProject?.membership) {
    if (newDisplayOrder === sourceProject.membership.displayOrder) return null;
    return {
      kind: 'membership',
      membershipId: sourceProject.membership.id,
      tenantId: sourceProject.tenantId,
      organizationId: sourceProject.organizationId,
      projectId: sourceProject.id,
      displayOrder: newDisplayOrder,
    };
  }

  // Local-only panel (explainer, ai-chat, …).
  return { kind: 'local', panelId: sourcePanelId, displayOrder: newDisplayOrder };
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
