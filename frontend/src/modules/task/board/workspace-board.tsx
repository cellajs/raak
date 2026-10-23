import { useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { boardStore, useBoardStore } from '~/modules/common/board/board-store';
import { ExplainerPanel } from '~/modules/common/board/explainer-panel';
import { LabelsPanel } from '~/modules/label/labels-panel';
import { useMemberUpdateMutation } from '~/modules/memberships/query-mutations';
import { buildBoardExtraPanels, computePanelReorder, useBoardPanels, useExpandLabelsPanel, useShowExplainer } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

export function WorkspaceBoard({ boardId, projects, workspace }: ResolvedBoardProps) {
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  const showExplainer = useShowExplainer(!!workspace);

  const extraPanels = useMemo(() => buildBoardExtraPanels({ showExplainer }), [showExplainer]);
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects, extraPanels);
  useExpandLabelsPanel(boardLayoutRef);

  const setPanelOrder = useBoardStore((state) => state.setPanelOrder);
  const { mutateAsync: updateMembership } = useMemberUpdateMutation();

  const handlePanelReorder = useCallback(
    (newOrder: string[], sourcePanelId: string) => {
      const localOrders = boardStore.getState().boardPanelOrders[boardId];
      const result = computePanelReorder(panels, localOrders, newOrder, sourcePanelId);
      if (!result) return;

      if (result.kind === 'membership') {
        updateMembership({
          path: { id: result.membershipId, tenantId: result.tenantId, organizationId: result.organizationId },
          body: { displayOrder: result.displayOrder },
          channelId: result.projectId,
          channelType: 'project',
        });
        return;
      }

      // Local-only panel (explainer, ai-chat, etc.), persist its new order.
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
    const targetPanel = panels.find((col) => col.kind === 'project' && col.project.id === targetProject.id);
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
      panelFade="marked"
      reorderable
      onPanelReorder={handlePanelReorder}
    >
      {(panelId) => {
        const panel = panels.find((c) => c.panelId === panelId);
        if (!panel) return null;
        if (panel.kind === 'labels') {
          return workspace ? <LabelsPanel entity="workspace" entityId={workspace.id} /> : null;
        }
        if (panel.kind === 'explainer') return <ExplainerPanel />;
        return <ProjectBoardPanel project={panel.project} sectionFilters={panel.sectionFilters} />;
      }}
    </BoardLayout>
  );
}
