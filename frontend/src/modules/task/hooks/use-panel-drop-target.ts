import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
  autoScrollForElements,
  autoScrollWindowForElements,
} from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { isTaskData } from '~/modules/task/helpers/drag-and-drop';
import { isProjectReadOnly } from '~/modules/task/hooks/use-read-only';
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
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!panelRef.current) return;

    return dropTargetForElements({
      element: panelRef.current,
      getData: () => ({
        dragItem: true,
        item: { projectId, tasks: tasksRef.current },
        type: 'panel',
        itemType: 'project',
      }),
      canDrop: ({ source: { data } }) => {
        if (!isTaskData(data)) return false;
        // Block drops from other projects into a read-only project
        if (data.item.projectId !== projectId && isProjectReadOnly(projectId)) return false;
        return true;
      },
      onDragEnter: ({ source: { data } }) => {
        if (!isTaskData(data) || data.item.projectId === projectId) return;
        setHighlightProject(true);
      },
      onDragLeave: () => setHighlightProject(false),
      onDrop: () => setHighlightProject(false),
    });
  }, [projectId, panelRef]);

  return { highlightProject };
}

/**
 * Attach vertical auto-scroll to a scrollable element during drag operations.
 * Lives separately from `usePanelDropTarget` because the scroll viewport only
 * exists in the expanded state, while the drop target must be live in both.
 *
 * When `scrollRef` has no element attached (mobile / windowScroll branches
 * where the page itself scrolls), falls back to window auto-scroll so that
 * dragging near the viewport edge still scrolls the page.
 */
export function usePanelAutoScroll(scrollRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (scrollRef.current) {
      return autoScrollForElements({
        element: scrollRef.current,
        getAllowedAxis: () => 'vertical',
      });
    }
    return autoScrollWindowForElements({
      getAllowedAxis: () => 'vertical',
    });
  }, [scrollRef]);
}
