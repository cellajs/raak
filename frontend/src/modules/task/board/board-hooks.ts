import { useCallback, useEffect, useMemo } from 'react';
import { getOrderBetween } from 'shared/utils/display-order';
import { useShallow } from 'zustand/react/shallow';
import type { BoardLayoutPanel } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { EXPLAINER_PANEL_ID } from '~/modules/common/board/explainer-panel';
import { LABELS_PANEL_ID } from '~/modules/label/types';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { normalizePanelWidths, prepareBoardPanels } from '~/modules/task/helpers/board-helpers';
import type { BoardResizablePanel } from '~/modules/task/types';

/** Default anchors for panels the server doesn't own: the explainer leads the board, the
 *  labels panel trails it, and project panels without an enriched membership (e.g. the
 *  single-project board) sit in between. Finite values keep the fractional reorder math working
 *  when a neighboring panel is dragged against them; user reorders (local orders) override. */
const kindDefaultOrders: Record<BoardResizablePanel['kind'], number> = {
  explainer: -1_000_000,
  project: 0,
  labels: 1_000_000,
};

/** Gap between the seeded default orders of a project's split panels. Small enough to keep the
 *  group at its membership anchor, large enough for `getOrderBetween` to fit drops in between. */
const splitSectionOrderStep = 0.001;

/** Resolve a panel's displayOrder.
 *  A device-local order (set by drag) wins; then the server-owned membership order (split panels
 *  offset it by sectionIndex so siblings get distinct, insertable orders); then the kind default. */
export function getPanelDisplayOrder(
  panel: BoardResizablePanel,
  localOrders: Record<string, number> = {},
): number | undefined {
  const localOrder = localOrders[panel.panelId];
  if (localOrder !== undefined) return localOrder;

  if (panel.kind === 'project') {
    const anchor = panel.project.membership?.displayOrder ?? kindDefaultOrders.project;
    if (panel.sectionFilters) return anchor + (panel.sectionIndex ?? 0) * splitSectionOrderStep;
    return anchor;
  }

  return kindDefaultOrders[panel.kind];
}

/** The non-project ("local") panels a board shows, in canonical order: the explainer leads and
 *  the labels panel trails (the kind default orders below re-sort them anyway). Single source of
 *  truth shared by the live boards and the loading skeleton so the two never disagree on which
 *  local panels exist. The explainer appears only when its welcome text is unseen; the labels
 *  panel appears on every board except an anonymous public view. */
export function buildBoardExtraPanels({
  showExplainer = false,
  publicView = false,
}: {
  showExplainer?: boolean;
  publicView?: boolean;
} = {}): BoardResizablePanel[] {
  const panels: BoardResizablePanel[] = [];
  if (showExplainer) panels.push({ kind: 'explainer', panelId: EXPLAINER_PANEL_ID });
  if (!publicView) panels.push({ kind: 'labels', panelId: LABELS_PANEL_ID });
  return panels;
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
 * Computes fractional panel order using the render comparator.
 * Unsplit projects persist membership order; split and local panels persist device-local order.
 */
export function computePanelReorder(
  panels: BoardResizablePanel[],
  localOrders: Record<string, number> | undefined,
  newOrder: string[],
  sourcePanelId: string,
  options?: { persist?: 'auto' | 'local' },
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

  // A single panel has no anchor for reordering.
  if (prevOrder == null && nextOrder == null) return null;

  const newDisplayOrder = getOrderBetween(prevOrder ?? undefined, nextOrder ?? undefined);
  // A float collision requires a future rebalance pass.
  if (newDisplayOrder === null) return null;

  const sourceProject = sourcePanel.kind === 'project' && !sourcePanel.sectionFilters ? sourcePanel.project : undefined;
  if (options?.persist !== 'local' && sourceProject?.membership) {
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

  // Split panel or local-only panel (explainer, labels, …): device-local order.
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
