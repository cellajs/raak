import { useRef } from 'react';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { LabelsPanel } from '~/modules/label/labels-panel';
import { buildBoardExtraPanels, useBoardPanels, useExpandLabelsPanel } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

/** A project page's board: To do, In progress and Done, then the labels panel for members. */
export function ProjectBoard({ boardId, projects, publicView }: ResolvedBoardProps) {
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  const extraPanels = buildBoardExtraPanels({ publicView });
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects, { extraPanels, projectPage: true });
  useExpandLabelsPanel(boardLayoutRef);

  return (
    <BoardLayout
      ref={boardLayoutRef}
      boardId={boardId}
      panels={layoutPanels}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
      panelFade="marked"
      autoHeight={publicView}
      mustFit={publicView}
    >
      {(panelId) => {
        const panel = panels.find((candidate) => candidate.panelId === panelId);
        if (panel?.kind === 'labels') return <LabelsPanel entity="project" entityId={boardId} />;
        if (panel?.kind !== 'project') return null;

        return (
          <ProjectBoardPanel
            project={panel.project}
            panelId={panel.panelId}
            publicView={publicView}
            statuses={panel.statuses}
            group={panel.group}
            windowScroll={publicView}
          />
        );
      }}
    </BoardLayout>
  );
}
