import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { defaultOrder, getRelativeOrder, orderGap } from 'shared/utils/display-order';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { sortTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

/**
 * Return task order for new task
 */
export const getNewTaskOrder = (
  status: number,
  tasks: Pick<Task, 'id' | 'displayOrder' | 'status' | '_draft' | 'projectId'>[],
  projectId?: string,
) => {
  // Filter out the create-task form, optionally scope to project, and keep the target status
  const filteredTasks = tasks.filter(
    (t) => !isDraftTask(t) && (!projectId || t.projectId === projectId) && t.status === status,
  );

  if (filteredTasks.length === 0) return defaultOrder;

  // "iced" / "unstarted" (status >= Unstarted) place the new task at the top (max + gap);
  // later statuses place it at the bottom (min − gap). Filter-then-min/max, no full sort.
  const orders = filteredTasks.map((t) => t.displayOrder);
  return status >= TaskStatus.Unstarted ? Math.max(...orders) + orderGap : Math.min(...orders) - orderGap;
};

/**
 * Calculate a new display order for a task being moved relative to another task (edge) in the same column.
 * Tasks use descending display order (higher = top).
 */
export const getRelativeTaskOrder = (edge: Edge, tasks: Task[], order: number, id: string, status?: TaskStatus) => {
  // Filter tasks by status if provided
  const filteredTasks: Task[] = status ? tasks.filter((t) => t.status === status && !isDraftTask(t)) : tasks;

  return getRelativeOrder(filteredTasks, order, id, edge, false);
};

/**
 * Return task order based on new status
 */
export const getNewStatusTaskOrder = (task: Task, newStatus: number) => {
  const oldStatus = task.status;
  const direction = oldStatus - newStatus;

  const tasks = cachedTasks();

  // Find the closest task with the new status
  const [closestTask] = tasks
    .filter((t) => t.projectId === task.projectId && t.status === newStatus && !isDraftTask(t))
    .sort((a, b) => sortTaskOrder(a, b, direction > 0));

  // Default order if no tasks found with the new status
  if (!closestTask) return defaultOrder;

  // Adjust the order based on direction
  return Math.floor(closestTask.displayOrder) + (direction > 0 ? -orderGap : orderGap);
};

/**
 * Return a display order for the draft create-task form card so it sorts
 * at the top (unstarted/iced) or bottom (started/etc.) of its status group.
 */
export const getDraftDisplayOrder = (status: number, projectId: string) => {
  const tasks = cachedTasks();
  const projectTasks = tasks.filter((t) => t.projectId === projectId && !isDraftTask(t) && t.status === status);

  const atTop = status >= TaskStatus.Unstarted;

  if (projectTasks.length === 0) return atTop ? 2000 : -2000;

  if (atTop) {
    const highest = Math.max(...projectTasks.map((t) => t.displayOrder));
    return highest + 1000;
  }

  const lowest = Math.min(...projectTasks.map((t) => t.displayOrder));
  return lowest - 1000;
};

/**
 * Index of the anchor task to insert a new task next to, given its status.
 * Early-stage statuses (iced/unstarted) search forward; later statuses search backward.
 */
export const getTargetIndexByStatus = (tasks: Task[], status: TaskStatus) => {
  const isForwardSearch = [TaskStatus.Iced, TaskStatus.Unstarted].includes(status);
  const matchesStatus = (task: Task) => task.status === status;
  return isForwardSearch ? tasks.findIndex(matchesStatus) : tasks.findLastIndex(matchesStatus);
};
