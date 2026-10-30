import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { boardStore, useBoardStore } from '~/modules/common/board/board-store';
import { ExplainerPanel } from '~/modules/common/board/explainer-panel';
import { LabelsPanel } from '~/modules/label/labels-panel';
import { useMemberUpdateMutation } from '~/modules/memberships/query-mutations';
import { buildBoardExtraPanels, computePanelReorder, useBoardPanels, useExpandLabelsPanel, useShowExplainer } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { TaskPanelHeader } from '~/modules/task/panel/task-panel-header';

export function WorkspaceBoard({ boardId, projects, workspace }: ResolvedBoardProps) {
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  const showExplainer = useShowExplainer(!!workspace);

  const extraPanels = buildBoardExtraPanels({ showExplainer });
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects, extraPanels);
  useExpandLabelsPanel(boardLayoutRef);

  const setPanelOrder = useBoardStore((state) => state.setPanelOrder);
  const { mutateAsync: updateMembership } = useMemberUpdateMutation();

  const handlePanelReorder = (newOrder: string[], sourcePanelId: string) => {
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

    setPanelOrder(boardId, result.panelId, result.displayOrder);
  };

  // Scrolls to the project panel when projectSlug changes, not on panel reorder
  const lastScrolledSlugRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!projectSlug || projectSlug === lastScrolledSlugRef.current) return;
    lastScrolledSlugRef.current = projectSlug;
    const targetProject = projects.find((project) => project.slug === projectSlug);
    if (!targetProject) return;
    const targetPanel = panels.find((panel) => panel.kind === 'project' && panel.project.id === targetProject.id);
    if (!targetPanel) return;
    boardLayoutRef.current?.expandAndScrollToPanel(targetPanel.panelId);
  }, [projectSlug, panels, projects]);

  const renderGroupHeader = (projectId: string) => {
    const project = projects.find(({ id }) => id === projectId);
    return project && <TaskPanelHeader project={project} />;
  };

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
      groupHeader={renderGroupHeader}
    >
      {(panelId) => {
        const panel = panels.find((candidate) => candidate.panelId === panelId);
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
