import { useMemo } from 'react';
import { BoardLayout } from '~/modules/common/board/board-layout';
import { LabelsPanel } from '~/modules/label/labels-panel';
import { useBoardPanels } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { type BoardResizablePanel, LABELS_PANEL_ID } from '~/modules/task/types';

export function ProjectBoard({ boardId, projects, publicView }: ResolvedBoardProps) {
  // Anonymous public views get no label management panel
  const extraPanels = useMemo(
    (): BoardResizablePanel[] | undefined => (publicView ? undefined : [{ kind: 'labels', panelId: LABELS_PANEL_ID }]),
    [publicView],
  );
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects, extraPanels);

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
        if (col?.kind === 'labels') return <LabelsPanel entity="project" entityId={boardId} />;
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
