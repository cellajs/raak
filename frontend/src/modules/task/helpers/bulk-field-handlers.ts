import { getNewStatusTaskOrder } from '~/modules/task/helpers/order-helpers';
import { getItemsSortedByName } from '~/modules/task/helpers/sort-helpers';
import { buildFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import type { Task, TaskStatusType } from '~/modules/task/types';

type Item = { id: string; name: string };

/** A picker over the items every task has: what it adds or removes is applied to each task's own list. */
const sharedListHandler = <T extends Item>(lists: T[][], onTaskChange: ((next: T[]) => void)[]) => {
  const current = [...lists];
  let shared = lists[0]?.filter((item) => lists.every((list) => list.some(({ id }) => id === item.id))) ?? [];
  const value = shared;

  const onChange = (updated: T[]) => {
    const added = updated.filter((item) => !shared.some(({ id }) => id === item.id));
    const removed = new Set(shared.filter((item) => !updated.some(({ id }) => id === item.id)).map(({ id }) => id));
    shared = updated;

    current.forEach((list, index) => {
      const toAdd = added.filter((item) => !list.some(({ id }) => id === item.id));
      if (!toAdd.length && !list.some(({ id }) => removed.has(id))) return;
      current[index] = getItemsSortedByName([...list.filter(({ id }) => !removed.has(id)), ...toAdd]);
      onTaskChange[index](current[index]);
    });
  };

  return { value, onChange };
};

/** Field handlers for several tasks at once, one update per task. Build one per dropdown session, as `buildFieldHandlers`. */
export const buildBulkFieldHandlers = (tasks: Task[], deps: Parameters<typeof buildFieldHandlers>[1]) => {
  const handlers = tasks.map((task) => buildFieldHandlers(task, deps));

  const onStatusChange = (newStatus: TaskStatusType) => {
    const placed: Task[] = [];
    tasks.forEach((task, index) => {
      if (task.status === newStatus) return;
      const displayOrder = getNewStatusTaskOrder(task, newStatus, placed);
      placed.push({ ...task, status: newStatus, displayOrder });
      handlers[index].onStatusChange(newStatus, displayOrder);
    });
  };

  return {
    labels: sharedListHandler(
      tasks.map(({ labels }) => labels),
      handlers.map(({ onLabelsChange }) => onLabelsChange),
    ),
    assignedTo: sharedListHandler(
      tasks.map(({ assignedTo }) => assignedTo),
      handlers.map(({ onAssignedToChange }) => onAssignedToChange),
    ),
    status: tasks.every(({ status }) => status === tasks[0]?.status) ? tasks[0]?.status : undefined,
    onStatusChange,
  };
};
