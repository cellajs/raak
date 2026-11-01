import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { type RefObject, useEffect, useState } from 'react';
import { useLatestRef } from '~/hooks/use-latest-ref';
import { useTaskDropLandingStore } from '~/modules/task/board/task-drop-landing-store';
import { canDropTaskIntoProject, getPanelLandingSlot, isTaskData } from '~/modules/task/helpers/drag-and-drop';
import { isCoarsePointerDevice } from '~/modules/task/helpers/mobile-drag-indicator';
import { scrollStatusIntoView } from '~/modules/task/helpers/panel-scroll-registry';
import type { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

interface UsePanelDropTargetOptions {
  panelRef: RefObject<HTMLDivElement | null>;
  projectId: string;
  tasks: Task[];
  /** The statuses the panel lists; a drag does not change a task's status, so others are refused. */
  statuses?: TaskStatus[];
}

/** Highlights a task panel while a task from another project is dragged over it, and marks where a drop on the panel lands; registered on the outer wrapper to stay live when collapsed. */
export function usePanelDropTarget({ panelRef, projectId, tasks, statuses }: UsePanelDropTargetOptions) {
  const [highlightProject, setHighlightProject] = useState(false);
  // getData() and canDrop read the latest values without re-registering the listeners
  const tasksRef = useLatestRef(tasks);
  const statusesRef = useLatestRef(statuses);

  useEffect(() => {
    if (!panelRef.current) return;

    const { setLanding } = useTaskDropLandingStore.getState();
    const clear = () => {
      setHighlightProject(false);
      setLanding(null);
    };

    return dropTargetForElements({
      element: panelRef.current,
      getData: () => ({ dragItem: true, item: { projectId, tasks: tasksRef.current }, type: 'panel', itemType: 'project' }),
      canDrop: ({ source: { data } }) => {
        if (!isTaskData(data) || (statusesRef.current && !statusesRef.current.includes(data.item.status))) return false;
        return canDropTaskIntoProject(data.item.projectId, projectId);
      },
      onDragEnter: ({ source: { data } }) => {
        if (!isTaskData(data) || data.item.projectId === projectId) return;
        setHighlightProject(true);
        // Once per panel entry; skipped on coarse pointers, where a window scroll mid-touch-drag would yank the page
        if (!isCoarsePointerDevice()) scrollStatusIntoView(projectId, data.item.status);
      },
      onDrag: ({ source: { data }, location }) => {
        if (!isTaskData(data) || data.item.projectId === projectId) return;
        // A same-status card under the pointer takes the drop and draws its own indicator
        const overCard = location.current.dropTargets.some((target) => isTaskData(target.data));
        setLanding(overCard ? null : getPanelLandingSlot(tasksRef.current, data.item.status));
      },
      onDragLeave: clear,
      onDrop: clear,
    });
  }, [projectId, panelRef]);

  return { highlightProject };
}
