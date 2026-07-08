import { useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useMemberUpdateMutation } from '~/modules/memberships/query-mutations';
import { computePanelReorder, useBoardPanels } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ExplainerPanel } from '~/modules/task/panel/explainer-panel';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

export function WorkspaceBoard({ boardId, projects, workspace }: ResolvedBoardProps) {
  const { projectSlug } = useSearch({ strict: false }) as { projectSlug?: string };
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  const alertsSeen = useAlertStore((s) => s.alertsSeen);
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
      const localOrders = useBoardStore.getState().boardPanelOrders[boardId];
      const result = computePanelReorder(panels, localOrders, newOrder, sourcePanelId);
      if (!result) return;

      if (result.kind === 'membership') {
        updateMembership({
          path: { id: result.membershipId, tenantId: result.tenantId, organizationId: result.organizationId },
          body: { displayOrder: result.displayOrder },
          entityId: result.projectId,
          entityType: 'project',
        });
        return;
      }

      // Local-only panel (explainer, ai-chat, …) — persist its new order.
      setPanelOrder(boardId, result.panelId, result.displayOrder);
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
