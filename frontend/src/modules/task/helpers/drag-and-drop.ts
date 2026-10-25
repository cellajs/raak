import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { defaultOrder } from 'shared/utils/display-order';
import { isProjectReadOnly } from '~/modules/project/use-read-only';
import type { TaskDropLanding } from '~/modules/task/board/task-drop-landing-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getTargetIndexByStatus } from '~/modules/task/helpers/order-helpers';
import { TaskStatus } from '~/modules/task/task-properties';
import type { PanelDraggableData, Task, TaskDraggableData } from '~/modules/task/types';

/** Same-project reorders are always allowed; a cross-project drop is blocked into a read-only target. Shared by the card and panel drop targets. */
export const canDropTaskIntoProject = (sourceProjectId: string, targetProjectId: string): boolean =>
  sourceProjectId === targetProjectId || !isProjectReadOnly(targetProjectId);

/** The card a task dropped on another project's panel lands next to, as `getNewTaskOrder` places it; null when the panel lists none of its status. */
export const getPanelLandingSlot = (tasks: Task[], status: TaskStatus): TaskDropLanding | null => {
  const placed = tasks.filter((task) => !isDraftTask(task));
  const anchor = placed[getTargetIndexByStatus(placed, status)];
  if (!anchor) return null;
  return { taskId: anchor.id, edge: status >= TaskStatus.Unstarted ? 'top' : 'bottom' };
};

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
