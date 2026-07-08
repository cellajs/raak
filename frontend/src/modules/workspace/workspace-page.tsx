import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FocusViewContainer } from '~/modules/common/focus-view';
import type { EntityEnrichment } from '~/modules/entities/types';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { useMobileTaskDragIndicatorStore } from '~/modules/task/board/mobile-drag-indicator-store';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { getEdgeAndTargetOrder, isPanelData, isTaskData } from '~/modules/task/helpers/drag-and-drop';
import { isCoarsePointerDevice, resolveMobileTaskDropIndicator } from '~/modules/task/helpers/mobile-drag-indicator';
import { getNewTaskOrder, getRelativeTaskOrder } from '~/modules/task/helpers/order-helpers';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { combinedTaskSearchSchema } from '~/modules/task/search-params-schemas';
import { TaskSheetHandler } from '~/modules/task/task-sheet-handler';
import { TasksHotkeys } from '~/modules/task/tasks-hotkeys';
import type { DropTarget, PanelDraggableData, TaskDraggableData } from '~/modules/task/types';
import { workspaceQueryOptions } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';

export type WorkspaceSearch = z.infer<typeof combinedTaskSearchSchema>;

interface Props {
  workspaceId: string;
  organizationId: string;
  tenantId: string;
  children: ReactNode;
}

/**
 * Workspace page with drag-and-drop task management.
 */
const WorkspacePage = ({ workspaceId, organizationId, tenantId, children }: Props) => {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(workspaceQueryOptions(workspaceId, organizationId, tenantId));
  const workspace = data as typeof data & EntityEnrichment;

  const { data: projectsData } = useSuspenseInfiniteQuery(projectsListQueryOptions({ workspaceId, include: 'counts' }));
  const projects = flattenInfiniteData<EnrichedProject>(projectsData);

  const { mutateAsync: updateTaskMutation } = useTaskUpdateMutation(tenantId, organizationId);
  // Stable ref so the monitorForElements effect doesn't re-register on mutation state changes
  const updateTaskRef = useRef(updateTaskMutation);
  updateTaskRef.current = updateTaskMutation;
  const activeDragSourceRef = useRef<TaskDraggableData['item'] | null>(null);
  const latestInputRef = useRef<{ clientX: number; clientY: number } | null>(null);

  const changeProject = async (data: { id: string; projectId: string; displayOrder?: number | null }) => {
    await updateTaskRef.current({
      id: data.id,
      ops: {
        projectId: data.projectId,
        ...(typeof data.displayOrder === 'number' && { displayOrder: data.displayOrder }),
      },
      fullLabels: [],
      fullAssignedTo: [],
    });
  };

  useEffect(() => {
    const { clearIndicator, setIndicator } = useMobileTaskDragIndicatorStore.getState();

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

    const onScroll = () => updateMobileIndicator();
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });

    return combine(
      () => {
        window.removeEventListener('scroll', onScroll, true);
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
          latestInputRef.current = {
            clientX: location.current.input.clientX,
            clientY: location.current.input.clientY,
          };
          updateMobileIndicator();
        },
        onDrop: async ({
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

          // Extract the source item data and ensure it belongs to the current project
          const { item: sourceItem } = sourceData;
          const {
            displayOrder: sourceOrder,
            projectId: sourceProjectId,
            status: sourceStatus,
            id: sourceId,
          } = sourceItem;

          try {
            // Resolve mobile drop first: the rect-derived indicator does not depend on Atlaskit's
            // dropTargets, which are frequently empty after touch autoscroll (virtua sets
            // pointer-events: none on the list while scrolling, so the native drag resolves to no
            // drop target). Handling it here keeps mobile drops from becoming a no-op.
            const mobileTargetTask = mobileIndicator
              ? cachedTasks().find((task) => task.id === mobileIndicator.taskId)
              : null;
            if (mobileIndicator && mobileTargetTask) {
              const tasks = cachedTasks().filter((task) => task.projectId === mobileTargetTask.projectId);
              const { targetOrder, edge } = getEdgeAndTargetOrder(
                mobileTargetTask,
                sourceItem,
                mobileIndicator.edge,
                tasks,
              );
              const newOrder = getRelativeTaskOrder(edge, tasks, targetOrder, sourceId, sourceStatus);

              if (newOrder === sourceOrder && sourceProjectId === mobileTargetTask.projectId) return;

              if (sourceProjectId !== mobileTargetTask.projectId) {
                await changeProject({
                  id: sourceId,
                  projectId: mobileTargetTask.projectId,
                  displayOrder: newOrder,
                });
                return;
              }

              await updateTaskRef.current({ id: sourceId, ops: { displayOrder: newOrder } });
              return;
            }

            // Identify the drop target types (task or column) from Atlaskit's drop targets
            const taskTargetData =
              dropTargets.find((el): el is DropTarget<TaskDraggableData> => isTaskData(el.data))?.data ?? null;
            const columnTargetData =
              dropTargets.find((el): el is DropTarget<PanelDraggableData> => isPanelData(el.data))?.data ?? null;

            // Exit early if no valid drop target exists
            if (!taskTargetData && !columnTargetData) return;

            // Handle column drop
            if (columnTargetData && !taskTargetData) {
              const {
                item: { tasks, projectId },
              } = columnTargetData;

              // Determine the new order based on task status within the column
              const order = getNewTaskOrder(sourceStatus, tasks);

              await changeProject({
                id: sourceId,
                projectId,
                displayOrder: order,
              });

              return;
            }

            if (taskTargetData && columnTargetData) {
              const {
                item: { tasks },
              } = columnTargetData;
              const { item: targetTask } = taskTargetData;

              const pragmaticEdge = extractClosestEdge(taskTargetData);
              if (!pragmaticEdge) throw new Error('Invalid drop edge');

              // Calculate new order
              const { targetOrder, edge } = getEdgeAndTargetOrder(targetTask, sourceItem, pragmaticEdge, tasks);
              const newOrder = getRelativeTaskOrder(edge, tasks, targetOrder, sourceId, sourceStatus);

              // Exit early if order remains the same within one project
              if (newOrder === sourceOrder && sourceProjectId === targetTask.projectId) return;

              if (sourceProjectId !== targetTask.projectId) {
                await changeProject({
                  id: sourceId,
                  projectId: targetTask.projectId,
                  displayOrder: newOrder,
                });
                return;
              }

              // Execute the mutation with new order
              await updateTaskRef.current({ id: sourceId, ops: { displayOrder: newOrder } });
              return;
            }
          } catch (err) {
            toast.error(t('error:reorder_resource', { resource: t('c:task') }));
          }
        },
      }),
    );
  }, [organizationId, tenantId, t]);

  return (
    <FocusViewContainer className="group/workspace h-full max-w-none gap-0 p-0 sm:gap-2 sm:p-3 md:gap-3">
      <TaskSheetHandler />
      <TasksHotkeys boardId={workspace.id} projects={projects} type="workspace" />
      {children}
    </FocusViewContainer>
  );
};

export { WorkspacePage };
