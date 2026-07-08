import { useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getOrderBetween } from 'shared/display-order';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useMemberUpdateMutation } from '~/modules/memberships/query-mutations';
import { getPanelDisplayOrder, useBoardPanels } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ExplainerPanel } from '~/modules/task/panel/explainer-panel';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

export function WorkspaceBoard({ boardId, projects, workspace }: ResolvedBoardProps) {
  const { projectSlug } = useSearch({ strict: false }) as { projectSlug?: string };
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  const { alertsSeen } = useAlertStore();
  const showExplainer = !!workspace && !alertsSeen.includes('welcome-text');

  const extraPanels = useMemo(() => {
    const panels: { panelId: string }[] = [];
    if (showExplainer) panels.push({ panelId: 'explainer' });
    return panels.length > 0 ? panels : undefined;
  }, [showExplainer]);
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects, extraPanels);

  const setPanelOrder = useBoardStore((state) => state.setPanelOrder);
  const { mutateAsync: updateMembership } = useMemberUpdateMutation();

  const handlePanelReorder = useCallback(
    (newOrder: string[], sourcePanelId: string) => {
      const sourcePanel = panels.find((p) => p.panelId === sourcePanelId);
      if (!sourcePanel) return;

      // Resolve neighbor orders via the render comparator, so server-owned
      // and local-only panels are treated uniformly when computing the new fractional order.
      const localOrders = useBoardStore.getState().boardPanelOrders[boardId];
      const panelById = new Map(panels.map((p) => [p.panelId, p]));
      const orderAt = (i: number): number | undefined => {
        if (i < 0 || i >= newOrder.length) return undefined;
        const neighbor = panelById.get(newOrder[i]);
        return neighbor ? getPanelDisplayOrder(neighbor, localOrders) : undefined;
      };

      const sourceIdx = newOrder.indexOf(sourcePanelId);
      const prevOrder = orderAt(sourceIdx - 1);
      const nextOrder = orderAt(sourceIdx + 1);

      // Single panel, no anchor to reorder against.
      if (prevOrder == null && nextOrder == null) return;

      const newDisplayOrder = getOrderBetween(prevOrder ?? undefined, nextOrder ?? undefined);
      // Float collision, a rebalance pass would be needed to recover.
      if (newDisplayOrder === null) return;

      const sourceProject = sourcePanel.project;
      if (sourceProject?.membership) {
        if (newDisplayOrder === sourceProject.membership.displayOrder) return;
        updateMembership({
          path: {
            id: sourceProject.membership.id,
            tenantId: sourceProject.tenantId,
            organizationId: sourceProject.organizationId,
          },
          body: { displayOrder: newDisplayOrder },
          entityId: sourceProject.id,
          entityType: 'project',
        });
        return;
      }

      // Local-only panel (explainer, ai-chat), persist its new order.
      setPanelOrder(boardId, sourcePanelId, newDisplayOrder);
    },
    [boardId, panels, setPanelOrder, updateMembership],
  );

  /** Scroll to project panel when projectSlug changes (not on panel reorder) */
  const lastScrolledSlug = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!projectSlug || projectSlug === lastScrolledSlug.current) return;
    lastScrolledSlug.current = projectSlug;
    const targetProject = projects.find((p) => p.slug === projectSlug);
    if (!targetProject) return;
    const targetPanel = panels.find((col) => col.project?.id === targetProject.id);
    if (!targetPanel) return;
    boardLayoutRef.current?.expandAndScrollToPanel(targetPanel.panelId);
  }, [projectSlug, panels, projects]);

  return (
    <BoardLayout
      ref={boardLayoutRef}
      boardId={boardId}
      panels={layoutPanels}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
      reorderable
      onPanelReorder={handlePanelReorder}
    >
      {(panelId) => {
        const panel = panels.find((c) => c.panelId === panelId);
        if (!panel?.project) return <ExplainerPanel />;
        return <ProjectBoardPanel project={panel.project} sectionFilters={panel.sectionFilters} />;
      }}
    </BoardLayout>
  );
}
