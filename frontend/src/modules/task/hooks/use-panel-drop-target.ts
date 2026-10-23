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

/** Highlights a task panel while a task from another project is dragged over it; registered on the outer wrapper to stay live when collapsed. */
export function usePanelDropTarget({ panelRef, projectId, tasks }: UsePanelDropTargetOptions) {
  const [highlightProject, setHighlightProject] = useState(false);
  // getData() reads the latest tasks without re-registering the listeners
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
        // Once per panel entry; skipped on coarse pointers, where a window scroll mid-touch-drag would yank the page
        if (!isCoarsePointerDevice()) scrollStatusIntoView(projectId, data.item.status);
      },
      onDragLeave: () => setHighlightProject(false),
      onDrop: () => setHighlightProject(false),
    });
  }, [projectId, panelRef]);

  return { highlightProject };
}
