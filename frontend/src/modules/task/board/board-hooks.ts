import { useSearch } from '@tanstack/react-router';
import { type RefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getOrderBetween } from 'shared/utils/display-order';
import { useShallow } from 'zustand/react/shallow';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import type { BoardLayoutHandle, BoardLayoutPanel } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { EXPLAINER_PANEL_ID } from '~/modules/common/board/explainer-panel';
import { LABELS_PANEL_ID } from '~/modules/label/types';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { normalizePanelWidths, pickViewSections, prepareBoardPanels, projectPanelName } from '~/modules/task/helpers/board-helpers';
import type { BoardResizablePanel } from '~/modules/task/types';

// Finite anchors keep the fractional reorder math working when a neighboring panel is dragged against them

const kindDefaultOrders: Record<BoardResizablePanel['kind'], number> = { explainer: -1_000_000, project: 0, labels: 1_000_000 };

// Small enough to keep a split group at its membership anchor, large enough for `getOrderBetween` to fit drops in between

const splitSectionOrderStep = 0.001;

/** A device-local order wins, then the membership order (split panels offset it by sectionIndex), then the kind default. */
export function getPanelDisplayOrder(panel: BoardResizablePanel, localOrders: Record<string, number> = {}): number | undefined {
  const localOrder = localOrders[panel.panelId];
  if (localOrder !== undefined) return localOrder;

  if (panel.kind === 'project') {
    const anchor = panel.project.membership?.displayOrder ?? kindDefaultOrders.project;
    if (panel.sectionFilters) return anchor + (panel.sectionIndex ?? 0) * splitSectionOrderStep;
    return anchor;
  }

  return kindDefaultOrders[panel.kind];
}

interface BuildBoardExtraPanelsOptions {
  showExplainer?: boolean;
  publicView?: boolean;
}

/** The local panels a board shows: the explainer while its welcome text is unseen, the labels panel except in a public view. */
export function buildBoardExtraPanels({ showExplainer = false, publicView = false }: BuildBoardExtraPanelsOptions = {}): BoardResizablePanel[] {
  const panels: BoardResizablePanel[] = [];
  if (showExplainer) panels.push({ kind: 'explainer', panelId: EXPLAINER_PANEL_ID });
  if (!publicView) panels.push({ kind: 'labels', panelId: LABELS_PANEL_ID });
  return panels;
}

/** Sorts panels by resolved displayOrder; panels without an order keep their relative position and trail. */
export function sortPanelsByOrder(panels: BoardResizablePanel[], localOrders: Record<string, number> = {}): BoardResizablePanel[] {
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

/** What a panel drag-reorder persists: a membership update, a local panel order, or null for a no-op. */
type PanelReorderResult =
  | { kind: 'membership'; membershipId: string; tenantId: string; organizationId: string; projectId: string; displayOrder: number }
  | { kind: 'local'; panelId: string; displayOrder: number }
  | null;

/** Fractional panel order from the render comparator; unsplit projects persist membership order, split and local panels a local one. */
export function computePanelReorder(
  panels: BoardResizablePanel[],
  localOrders: Record<string, number> | undefined,
  newOrder: string[],
  sourcePanelId: string,
  options?: { persist?: 'auto' | 'local' },
): PanelReorderResult {
  const sourcePanel = panels.find((panel) => panel.panelId === sourcePanelId);
  if (!sourcePanel) return null;

  const panelById = new Map(panels.map((panel) => [panel.panelId, panel]));
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

  // Split panels and local-only panels (explainer, labels) persist a device-local order
  return { kind: 'local', panelId: sourcePanelId, displayOrder: newDisplayOrder };
}

/** The board's panels in display order with their stored widths; the loading skeleton lays out the same way. */
export function usePanelLayout(boardId: string, projects: EnrichedProject[], extraPanels?: BoardResizablePanel[]) {
  // Projected past the expand prefs so an iced/accepted toggle does not rebuild every panel
  const viewSections = useTaskBoardStore(useShallow((state) => pickViewSections(state.panelData[boardId])));
  const storedBoardLayout = useBoardStore((state) => state.boardLayouts[boardId]);
  const localOrders = useBoardStore((state) => state.boardPanelOrders[boardId]);

  const panels = sortPanelsByOrder([...prepareBoardPanels(projects, viewSections), ...(extraPanels ?? [])], localOrders);
  const defaultLayout = normalizePanelWidths(
    storedBoardLayout ?? {},
    panels.map(({ panelId }) => panelId),
  );

  return { panels, defaultLayout };
}

export function useBoardPanels(boardId: string, projects: EnrichedProject[], extraPanels?: BoardResizablePanel[]) {
  const { t } = useTranslation();
  const { panels, defaultLayout } = usePanelLayout(boardId, projects, extraPanels);
  const prunePanelOrders = useBoardStore((state) => state.prunePanelOrders);
  const updateBoardLayout = useBoardStore((state) => state.updateBoardLayout);

  useEffect(() => {
    prunePanelOrders(
      boardId,
      panels.map(({ panelId }) => panelId),
    );
  }, [boardId, panels, prunePanelOrders]);

  const layoutPanels: BoardLayoutPanel[] = panels.map((panel) => ({
    panelId: panel.panelId,
    label:
      panel.kind === 'project'
        ? projectPanelName(panel.project, panel.sectionFilters)
        : t(panel.kind === 'labels' ? 'c:label_other' : 'c:getting_started'),
  }));

  const handleLayoutChanged = (layout: Record<string, number>) => {
    updateBoardLayout(boardId, layout);
  };

  return { panels, layoutPanels, defaultLayout, handleLayoutChanged };
}

/** Whether the board shows the getting-started panel: in a workspace, until its welcome text has been seen. */
export function useShowExplainer(isInWorkspace: boolean) {
  const isWelcomeSeen = useAlertStore((state) => state.alertsSeen.includes('welcome-text'));
  return isInWorkspace && !isWelcomeSeen;
}

/** A label link expands and reveals the labels panel, whose list then opens that label's tile. */
export function useExpandLabelsPanel(boardLayoutRef: RefObject<BoardLayoutHandle | null>) {
  const labelPageId = useSearch({ strict: false, select: (search) => search.labelPageId });
  const lastExpandedLabelPageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!labelPageId || labelPageId === lastExpandedLabelPageRef.current) return;
    lastExpandedLabelPageRef.current = labelPageId;
    boardLayoutRef.current?.expandAndScrollToPanel(LABELS_PANEL_ID);
  }, [labelPageId, boardLayoutRef]);
}
