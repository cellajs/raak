import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLatestRef } from '~/hooks/use-latest-ref';
import { toaster } from '~/modules/common/toaster/toaster';
import { useMobileTaskDragIndicatorStore } from '~/modules/task/board/mobile-drag-indicator-store';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { getEdgeAndTargetOrder, isPanelData, isTaskData } from '~/modules/task/helpers/drag-and-drop';
import { isCoarsePointerDevice, resolveMobileTaskDropIndicator } from '~/modules/task/helpers/mobile-drag-indicator';
import { getNewTaskOrder, getRelativeTaskOrder } from '~/modules/task/helpers/order-helpers';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { DropTarget, PanelDraggableData, Task, TaskDraggableData } from '~/modules/task/types';

/** Registers the global monitor that commits task drops; mount once per page that renders a task board. */
export const useTaskDropMonitor = (tenantId: string, organizationId: string) => {
  const { t } = useTranslation();

  const { mutate: updateTaskMutation } = useTaskUpdateMutation(tenantId, organizationId);
  const updateTaskRef = useLatestRef(updateTaskMutation);
  const activeDragSourceRef = useRef<TaskDraggableData['item'] | null>(null);
  const latestInputRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const changeProject = (data: { id: string; projectId: string; displayOrder: number }) => {
    updateTaskRef.current({
      id: data.id,
      ops: { projectId: data.projectId, displayOrder: data.displayOrder },
      fullLabels: [],
      fullAssignedTo: [],
    });
  };

  const dropNextToTask = (sourceItem: Task, targetTask: Task, pragmaticEdge: Edge, tasks: Task[]) => {
    const { id, displayOrder, projectId, status } = sourceItem;
    const { targetOrder, edge } = getEdgeAndTargetOrder(targetTask, sourceItem, pragmaticEdge, tasks);
    const newOrder = getRelativeTaskOrder(edge, tasks, targetOrder, id, status);

    if (projectId !== targetTask.projectId) changeProject({ id, projectId: targetTask.projectId, displayOrder: newOrder });
    else if (newOrder !== displayOrder) updateTaskRef.current({ id, ops: { displayOrder: newOrder } });
  };

  useEffect(() => {
    const { clearIndicator, setIndicator } = useMobileTaskDragIndicatorStore.getState();
    const reportReorderFailure = () => toaster.error(t('error:reorder_resource', { resource: t('c:task') }));

    const updateMobileIndicator = () => {
      if (!isCoarsePointerDevice()) return clearIndicator();
      if (!activeDragSourceRef.current || !latestInputRef.current) return clearIndicator();

      const indicator = resolveMobileTaskDropIndicator({
        clientX: latestInputRef.current.clientX,
        clientY: latestInputRef.current.clientY,
        sourceTask: activeDragSourceRef.current,
      });

      setIndicator(indicator?.taskId ? indicator : null);
    };

    window.addEventListener('scroll', updateMobileIndicator, { capture: true, passive: true });

    return combine(
      () => {
        window.removeEventListener('scroll', updateMobileIndicator, true);
        activeDragSourceRef.current = null;
        latestInputRef.current = null;
        clearIndicator();
      },
      monitorForElements({
        canMonitor: ({ source: { data } }) => isTaskData(data),
        onDragStart: ({ source }) => {
          if (!isTaskData(source.data)) return;
          activeDragSourceRef.current = source.data.item;
          latestInputRef.current = null;
          clearIndicator();
        },
        onDrag: ({ source, location }) => {
          if (!isTaskData(source.data)) return;
          activeDragSourceRef.current = source.data.item;
          latestInputRef.current = { clientX: location.current.input.clientX, clientY: location.current.input.clientY };
          updateMobileIndicator();
        },
        onDrop: ({
          location: {
            current: { dropTargets },
          },
          source: { data: sourceData },
        }) => {
          const mobileIndicator = useMobileTaskDragIndicatorStore.getState().indicator;
          clearIndicator();
          activeDragSourceRef.current = null;
          latestInputRef.current = null;

          if (!isTaskData(sourceData)) return;

          const { item: sourceItem } = sourceData;

          try {
            // The mobile drop resolves first: Atlaskit's dropTargets are often empty after touch autoscroll (virtua blocks pointer events)
            const mobileTargetTask = mobileIndicator ? cachedTasks().find((task) => task.id === mobileIndicator.taskId) : null;
            if (mobileIndicator && mobileTargetTask) {
              const tasks = cachedTasks().filter((task) => task.projectId === mobileTargetTask.projectId);
              dropNextToTask(sourceItem, mobileTargetTask, mobileIndicator.edge, tasks);
              return;
            }

            const taskTargetData =
              dropTargets.find((dropTarget): dropTarget is DropTarget<TaskDraggableData> => isTaskData(dropTarget.data))?.data ?? null;
            const columnTargetData =
              dropTargets.find((dropTarget): dropTarget is DropTarget<PanelDraggableData> => isPanelData(dropTarget.data))?.data ?? null;

            if (columnTargetData && !taskTargetData) {
              const {
                item: { tasks, projectId },
              } = columnTargetData;

              changeProject({ id: sourceItem.id, projectId, displayOrder: getNewTaskOrder(sourceItem.status, tasks) });
              return;
            }

            if (taskTargetData && columnTargetData) {
              const pragmaticEdge = extractClosestEdge(taskTargetData);
              if (!pragmaticEdge) return reportReorderFailure();

              dropNextToTask(sourceItem, taskTargetData.item, pragmaticEdge, columnTargetData.item.tasks);
            }
          } catch {
            reportReorderFailure();
          }
        },
      }),
    );
  }, [t]);
};
