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

/** The display order for a task dropped on an edge of another in the same column; orders descend, higher is on top. */
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

  const [closestTask] = tasks
    .filter((other) => other.projectId === task.projectId && other.status === newStatus && !isDraftTask(other))
    .sort((a, b) => compareTaskOrder(a, b, direction > 0));

  if (!closestTask) return defaultOrder;

  return Math.floor(closestTask.displayOrder) + (direction > 0 ? -orderGap : orderGap);
};

// Far beyond the group's edge compared with the `orderGap` between real rows, so the draft stays its outermost row while rows are created next to it
const draftOrderGap = 1000;
const draftEmptyOrder = 2000;

/** Sorts the create-form draft at the top of the unstarted/iced groups and the bottom of the others. */
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

/** The anchor task to insert next to: the first of its status for iced/unstarted, the last for the later statuses. */
export const getTargetIndexByStatus = (tasks: Task[], status: TaskStatus) => {
  const isForwardSearch = [TaskStatus.Iced, TaskStatus.Unstarted].includes(status);
  const matchesStatus = (task: Task) => task.status === status;
  return isForwardSearch ? tasks.findIndex(matchesStatus) : tasks.findLastIndex(matchesStatus);
};
