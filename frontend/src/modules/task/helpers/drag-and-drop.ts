import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { defaultOrder } from 'shared/utils/display-order';
import { isProjectReadOnly } from '~/modules/project/use-read-only';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import type { PanelDraggableData, Task, TaskDraggableData } from '~/modules/task/types';

/**
 * Whether a task from `sourceProjectId` may be dropped into `targetProjectId`: same-project
 * reorders are always allowed; cross-project drops are blocked into a read-only target.
 * Single source of this rule for both the card and panel drop targets.
 */
export const canDropTaskIntoProject = (sourceProjectId: string, targetProjectId: string): boolean =>
  sourceProjectId === targetProjectId || !isProjectReadOnly(targetProjectId);

/** Checks whether drag data represents a board panel. */
export const isPanelData = (data: Record<string | symbol, unknown>): data is PanelDraggableData => {
  return data.dragItem === true && typeof data.type === 'string' && data.type === 'panel';
};
/** Checks whether drag data represents a task card. */
export const isTaskData = (data: Record<string | symbol, unknown>): data is TaskDraggableData => {
  return data.dragItem === true && typeof data.displayOrder === 'number' && data.type === 'task';
};

/** Returns the edge and target order. */
export const getEdgeAndTargetOrder = (target: Task, source: Task, passedEdge: Edge, tasks: Task[]) => {
  // Determine the calculated edge based on status change
  const isStatusChanged = target.status !== source.status;
  const edge = isStatusChanged ? (target.status > source.status ? 'top' : 'bottom') : passedEdge;

  // Filter tasks with the same status as the source item only if status has changed
  let targetOrder = target.displayOrder;
  if (isStatusChanged) {
    const statusTasks = tasks.filter((el) => el.status === source.status && !isDraftTask(el));
    if (statusTasks.length)
      targetOrder = edge === 'top' ? statusTasks[0].displayOrder : statusTasks[statusTasks.length - 1].displayOrder;
    else targetOrder = defaultOrder;
  }
  return { targetOrder, edge };
};
