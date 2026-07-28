import { useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { ExplainerPanel } from '~/modules/common/board/explainer-panel';
import { LabelsPanel } from '~/modules/label/labels-panel';
import { LABELS_PANEL_ID } from '~/modules/label/types';
import { useMemberUpdateMutation } from '~/modules/memberships/query-mutations';
import { buildBoardExtraPanels, computePanelReorder, useBoardPanels } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

/** Renders the workspace board component. */
export function WorkspaceBoard({ boardId, projects, workspace }: ResolvedBoardProps) {
  const { projectSlug, labelPageId } = useSearch({ strict: false }) as { projectSlug?: string; labelPageId?: string };
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  const alertsSeen = useAlertStore((s) => s.alertsSeen);
  const showExplainer = !!workspace && !alertsSeen.includes('welcome-text');

  const extraPanels = useMemo(() => buildBoardExtraPanels({ showExplainer }), [showExplainer]);
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

  /** Opening a label page expands and reveals the labels panel (deep links, filter jumps) */
  const lastExpandedLabelPage = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!labelPageId || labelPageId === lastExpandedLabelPage.current) return;
    lastExpandedLabelPage.current = labelPageId;
    boardLayoutRef.current?.expandAndScrollToPanel(LABELS_PANEL_ID);
  }, [labelPageId]);

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
