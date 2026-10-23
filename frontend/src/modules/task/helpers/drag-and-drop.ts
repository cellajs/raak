import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { defaultOrder } from 'shared/utils/display-order';
import { isProjectReadOnly } from '~/modules/project/use-read-only';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import type { PanelDraggableData, Task, TaskDraggableData } from '~/modules/task/types';

/** Same-project reorders are always allowed; a cross-project drop is blocked into a read-only target. Shared by the card and panel drop targets. */
export const canDropTaskIntoProject = (sourceProjectId: string, targetProjectId: string): boolean =>
  sourceProjectId === targetProjectId || !isProjectReadOnly(targetProjectId);

export const isPanelData = (data: Record<string | symbol, unknown>): data is PanelDraggableData => {
  return data.dragItem === true && data.type === 'panel';
};

export const isTaskData = (data: Record<string | symbol, unknown>): data is TaskDraggableData => {
  return data.dragItem === true && typeof data.displayOrder === 'number' && data.type === 'task';
};

export const getEdgeAndTargetOrder = (target: Task, source: Task, passedEdge: Edge, tasks: Task[]) => {
  const isStatusChanged = target.status !== source.status;
  const edge = isStatusChanged ? (target.status > source.status ? 'top' : 'bottom') : passedEdge;

  let targetOrder = target.displayOrder;
  if (isStatusChanged) {
    const statusTasks = tasks.filter((task) => task.status === source.status && !isDraftTask(task));
    if (statusTasks.length) targetOrder = edge === 'top' ? statusTasks[0].displayOrder : statusTasks[statusTasks.length - 1].displayOrder;
    else targetOrder = defaultOrder;
  }
  return { targetOrder, edge };
};
