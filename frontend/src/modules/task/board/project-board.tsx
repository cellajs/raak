import { useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BoardLayout, type BoardLayoutHandle } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { LabelsPanel } from '~/modules/label/labels-panel';
import { LABELS_PANEL_ID } from '~/modules/label/types';
import { buildBoardExtraPanels, computePanelReorder, useBoardPanels } from '~/modules/task/board/board-hooks';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

/** Renders the project board component. */
export function ProjectBoard({ boardId, projects, publicView }: ResolvedBoardProps) {
  const { labelPageId } = useSearch({ strict: false }) as { labelPageId?: string };
  const boardLayoutRef = useRef<BoardLayoutHandle>(null);

  // Anonymous public views get no label management panel
  const extraPanels = useMemo(() => buildBoardExtraPanels({ publicView }), [publicView]);
  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects, extraPanels);

  const setPanelOrder = useBoardStore((state) => state.setPanelOrder);

  // All reorders on a single-project board persist device-locally: membership displayOrder
  // is owned by the workspace board and must not change from here.
  const handlePanelReorder = useCallback(
    (newOrder: string[], sourcePanelId: string) => {
      const localOrders = useBoardStore.getState().boardPanelOrders[boardId];
      const result = computePanelReorder(panels, localOrders, newOrder, sourcePanelId, { persist: 'local' });
      if (result?.kind !== 'local') return;
      setPanelOrder(boardId, result.panelId, result.displayOrder);
    },
    [boardId, panels, setPanelOrder],
  );

  /** Opening a label page expands and reveals the labels panel (deep links, filter jumps) */
  const lastExpandedLabelPage = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!labelPageId || labelPageId === lastExpandedLabelPage.current) return;
    lastExpandedLabelPage.current = labelPageId;
    boardLayoutRef.current?.expandAndScrollToPanel(LABELS_PANEL_ID);
  }, [labelPageId]);

  return (
    <BoardLayout
      ref={boardLayoutRef}
      boardId={boardId}
      panels={layoutPanels}
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
      autoHeight
      reorderable={!publicView}
      onPanelReorder={handlePanelReorder}
    >
      {(panelId) => {
        const col = panels.find((c) => c.panelId === panelId);
        if (col?.kind === 'labels') return <LabelsPanel entity="project" entityId={boardId} windowScroll />;
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
