import { useRef } from 'react';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { boardStore, useBoardStore } from '~/modules/common/board/board-store';
import { LabelsPanel } from '~/modules/label/labels-panel';
import { buildBoardExtraPanels, computePanelReorder, useBoardPanels, useExpandLabelsPanel } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { TaskPanelHeader } from '~/modules/task/panel/task-panel-header';

export function ProjectBoard({ boardId, projects, publicView }: ResolvedBoardProps) {
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  const extraPanels = buildBoardExtraPanels({ publicView });
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged, handleGroupCollapse } = useBoardPanels(boardId, projects, extraPanels);
  useExpandLabelsPanel(boardLayoutRef);

  const setPanelOrder = useBoardStore((state) => state.setPanelOrder);

  // All reorders on a single-project board persist device-locally: membership displayOrder
  // is owned by the workspace board and must not change from here.
  const handlePanelReorder = (newOrder: string[], sourcePanelId: string) => {
    const localOrders = boardStore.getState().boardPanelOrders[boardId];
    const result = computePanelReorder(panels, localOrders, newOrder, sourcePanelId, { persist: 'local' });
    if (result?.kind !== 'local') return;
    setPanelOrder(boardId, result.panelId, result.displayOrder);
  };

  const renderGroupHeader = (projectId: string) => {
    const project = projects.find(({ id }) => id === projectId);
    return project && <TaskPanelHeader project={project} publicView={publicView} spansSections />;
  };

  return (
    <BoardLayout
      ref={boardLayoutRef}
      boardId={boardId}
      panels={layoutPanels}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
      panelFade="marked"
      autoHeight
      reorderable={!publicView}
      onPanelReorder={handlePanelReorder}
      groupHeader={renderGroupHeader}
      onGroupCollapse={handleGroupCollapse}
    >
      {(panelId) => {
        const panel = panels.find((candidate) => candidate.panelId === panelId);
        if (panel?.kind === 'labels') return <LabelsPanel entity="project" entityId={boardId} windowScroll />;
        if (panel?.kind !== 'project') return null;

        return <ProjectBoardPanel project={panel.project} publicView={publicView} sectionFilters={panel.sectionFilters} windowScroll />;
      }}
    </BoardLayout>
  );
}
