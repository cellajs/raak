import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { type RefObject, useEffect, useState } from 'react';
import { useLatestRef } from '~/hooks/use-latest-ref';
import { canDropTaskIntoProject, isTaskData } from '~/modules/task/helpers/drag-and-drop';
import { isCoarsePointerDevice } from '~/modules/task/helpers/mobile-drag-indicator';
import { scrollStatusIntoView } from '~/modules/task/helpers/panel-scroll-registry';
import type { Task } from '~/modules/task/types';

interface UsePanelDropTargetOptions {
  panelRef: RefObject<HTMLDivElement | null>;
  projectId: string;
  tasks: Task[];
}

/**
 * Hook to set up drag-and-drop target behavior for a task panel.
 * Handles highlighting when dragging tasks from other projects.
 *
 * Registers on the outer panel wrapper so the drop target is live in both
 * expanded and collapsed states.
 */
export function usePanelDropTarget({ panelRef, projectId, tasks }: UsePanelDropTargetOptions) {
  const [highlightProject, setHighlightProject] = useState(false);
  // Use ref so getData() always reads the latest tasks without re-registering listeners
  const tasksRef = useLatestRef(tasks);

  useEffect(() => {
    if (!panelRef.current) return;

    return dropTargetForElements({
      element: panelRef.current,
      getData: () => ({ dragItem: true, item: { projectId, tasks: tasksRef.current }, type: 'panel', itemType: 'project' }),
      canDrop: ({ source: { data } }) => {
        if (!isTaskData(data)) return false;
        return canDropTaskIntoProject(data.item.projectId, projectId);
      },
      onDragEnter: ({ source: { data } }) => {
        if (!isTaskData(data) || data.item.projectId === projectId) return;
        setHighlightProject(true);
        // Bring this panel's source-status band into view so the drag gets between-card drop
        // targets; fires once per panel entry (moving over child cards keeps the panel in the
        // drop chain). Skipped on coarse pointers: they resolve drops via the rect-derived
        // mobile indicator, and a window scroll mid-touch-drag would yank the page.
        if (!isCoarsePointerDevice()) scrollStatusIntoView(projectId, data.item.status);
      },
      onDragLeave: () => setHighlightProject(false),
      onDrop: () => setHighlightProject(false),
    });
  }, [projectId, panelRef]);

  return { highlightProject };
}
