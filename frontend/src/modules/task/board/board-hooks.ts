import { useSearch } from '@tanstack/react-router';
import { type RefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getOrderBetween } from 'shared/utils/display-order';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import type { BoardLayoutHandle, BoardLayoutPanel } from '~/modules/common/board/board-layout';
import { boardStore, useBoardStore } from '~/modules/common/board/board-store';
import { EXPLAINER_PANEL_ID } from '~/modules/common/board/explainer-panel';
import { LABELS_PANEL_ID } from '~/modules/label/types';
import type { ProjectWithMembership } from '~/modules/project/types';
import {
  findProjectPageGroup,
  normalizePanelWidths,
  prepareBoardPanels,
  projectPageGroups,
  projectPanelName,
  sortByMembership,
} from '~/modules/task/helpers/board-helpers';
import { isBoardSearchActive } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import type { BoardResizablePanel } from '~/modules/task/types';

// Finite anchors keep the fractional reorder math working when a neighboring panel is dragged against them

const kindDefaultOrders: Record<BoardResizablePanel['kind'], number> = { explainer: -1_000_000, project: 0, labels: 1_000_000 };

/** A device-local order wins, then the membership order, then the kind default. */
export function getPanelDisplayOrder(panel: BoardResizablePanel, localOrders: Record<string, number> = {}): number | undefined {
  const localOrder = localOrders[panel.panelId];
  if (localOrder !== undefined) return localOrder;

  if (panel.kind === 'project') return panel.project.membership?.displayOrder ?? kindDefaultOrders.project;

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

/** Fractional panel order from the render comparator; projects persist membership order, local panels a local one. */
export function computePanelReorder(
  panels: BoardResizablePanel[],
  localOrders: Record<string, number> | undefined,
  newOrder: string[],
  sourcePanelId: string,
): PanelReorderResult {
  const panelById = new Map(panels.map((panel) => [panel.panelId, panel]));
  const sourcePanel = panelById.get(sourcePanelId);
  if (!sourcePanel) return null;

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

  // Local-only panels (explainer, labels) persist a device-local order
  return { kind: 'local', panelId: sourcePanelId, displayOrder: newDisplayOrder };
}

interface PanelLayoutOptions {
  extraPanels?: BoardResizablePanel[];
  /** A project page's panels follow the flow and never reorder, so stored local orders do not apply. Its labels panel starts collapsed. */
  projectPage?: boolean;
}

/** The board's panels in display order with their stored widths; the loading skeleton lays out the same way. */
export function usePanelLayout(
  boardId: string,
  projects: ProjectWithMembership[],
  { extraPanels = [], projectPage = false }: PanelLayoutOptions = {},
) {
  const storedBoardLayout = useBoardStore((state) => state.boardLayouts[boardId]);
  const localOrders = useBoardStore((state) => state.boardPanelOrders[boardId]);

  const boardPanels = [...prepareBoardPanels(projects, projectPage), ...extraPanels];
  const panels = projectPage ? boardPanels : sortPanelsByOrder(boardPanels, localOrders);
  // Folded before this board stored a width for it, as a sample's first view is; unsubscribed, as the layout only seeds the group
  const folded = useBoardStore.getState().panelCollapseState;
  const startCollapsed = panels.filter(({ panelId }) => folded[panelId]).map(({ panelId }) => panelId);
  const defaultLayout = normalizePanelWidths(storedBoardLayout ?? {}, panels, projectPage ? [LABELS_PANEL_ID, ...startCollapsed] : startCollapsed);

  return { panels, defaultLayout };
}

export function useBoardPanels(boardId: string, projects: ProjectWithMembership[], options?: PanelLayoutOptions) {
  const { t } = useTranslation();
  const { panels, defaultLayout } = usePanelLayout(boardId, projects, options);
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
      panel.kind === 'project' ? projectPanelName(panel.project, panel.group) : t(panel.kind === 'labels' ? 'c:label_other' : 'c:getting_started'),
  }));

  // A report holds the panels mounted now, a must-fit one only those with a chosen width: the others keep theirs
  const handleLayoutChanged = (layout: Record<string, number>) => {
    updateBoardLayout(boardId, { ...boardStore.getState().boardLayouts[boardId], ...layout });
  };

  return { panels, layoutPanels, defaultLayout, handleLayoutChanged };
}

/** The project a phone's workspace board shows: the one its tab names, else the first in membership order. */
export function useTabProject(projects: ProjectWithMembership[]) {
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });
  const sorted = sortByMembership(projects);
  return sorted.find((project) => project.slug === projectSlug) ?? sorted[0];
}

/** A phone project page's open tab, To do while none is chosen; none while a search lists every status. */
export function useProjectPageTab() {
  const panelTab = useSearch({ strict: false, select: (search) => search.panelTab });
  const isSearching = isBoardSearchActive(useBoardSearch());
  return isSearching ? undefined : (findProjectPageGroup(panelTab) ?? projectPageGroups[0]);
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
