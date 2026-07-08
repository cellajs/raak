import { BoardLayout } from '~/modules/common/board/board-layout';
import { useBoardPanels } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

export function ProjectBoard({ boardId, projects, publicView }: ResolvedBoardProps) {
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects);

  return (
    <BoardLayout
      boardId={boardId}
      panels={layoutPanels}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
      autoHeight
    >
      {(panelId) => {
        const col = panels.find((c) => c.panelId === panelId);
        if (col?.kind !== 'project') return null;

        return (
          <ProjectBoardPanel
            project={col.project}
            publicView={publicView}
            sectionFilters={col.sectionFilters}
            windowScroll
          />
        );
      }}
    </BoardLayout>
  );
}
