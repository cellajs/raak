import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { defaultOrder, getEdgeOrder, getRelativeOrder, orderGap } from 'shared/utils/display-order';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { compareTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

export const getNewTaskOrder = (
  status: number,
  tasks: Pick<Task, 'id' | 'displayOrder' | 'status' | '_draft' | 'projectId'>[],
  projectId?: string,
) => {
  const orders = tasks
    .filter((task) => !isDraftTask(task) && (!projectId || task.projectId === projectId) && task.status === status)
    .map(({ displayOrder }) => displayOrder);

  return getEdgeOrder(orders, status >= TaskStatus.Unstarted ? 'top' : 'bottom', false);
};

/**
 * Calculate a new display order for a task being moved relative to another task (edge) in the same column.
 * Tasks use descending display order (higher = top).
 */
export const getRelativeTaskOrder = (
  edge: Edge,
  tasks: Pick<Task, 'id' | 'displayOrder' | 'status' | '_draft'>[],
  order: number,
  id: string,
  status?: TaskStatus,
) => {
  const filteredTasks = status === undefined ? tasks : tasks.filter((task) => task.status === status && !isDraftTask(task));

  return getRelativeOrder(filteredTasks, order, id, edge, false);
};

/** `placed`: tasks moved earlier in the same batch, whose optimistic writes have not reached the cache yet. */
export const getNewStatusTaskOrder = (task: Task, newStatus: number, placed: Task[] = []) => {
  const oldStatus = task.status;
  const direction = oldStatus - newStatus;

  const tasks = [...cachedTasks(), ...placed];

  // Find the closest task with the new status
  const [closestTask] = tasks
    .filter((other) => other.projectId === task.projectId && other.status === newStatus && !isDraftTask(other))
    .sort((a, b) => compareTaskOrder(a, b, direction > 0));

  // Default order if no tasks found with the new status
  if (!closestTask) return defaultOrder;

  // Adjust the order based on direction
  return Math.floor(closestTask.displayOrder) + (direction > 0 ? -orderGap : orderGap);
};

// Far wider than `orderGap`, so the draft never sorts between two real rows
const draftOrderGap = 1000;
const draftEmptyOrder = 2000;

/**
 * Return a display order for the draft create-task form card so it sorts
 * at the top (unstarted/iced) or bottom (started/etc.) of its status group.
 */
export const getDraftDisplayOrder = (status: number, projectId: string) => {
  const tasks = cachedTasks();
  const projectTasks = tasks.filter((task) => task.projectId === projectId && !isDraftTask(task) && task.status === status);

  const atTop = status >= TaskStatus.Unstarted;

  if (projectTasks.length === 0) return atTop ? draftEmptyOrder : -draftEmptyOrder;

  if (atTop) {
    const highest = Math.max(...projectTasks.map((task) => task.displayOrder));
    return highest + draftOrderGap;
  }

  const lowest = Math.min(...projectTasks.map((task) => task.displayOrder));
  return lowest - draftOrderGap;
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
