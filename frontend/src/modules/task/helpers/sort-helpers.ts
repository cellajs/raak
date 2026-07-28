import { appConfig } from 'shared';
import type { Task } from '~/modules/task/types';

/** Returns the items sorted by name. */
export const getItemsSortedByName = <T extends { name: string }>(items: T[]): T[] => {
  // slice used so that the original array is not mutated
  return items.slice().sort((a, b) => a.name.localeCompare(b.name, appConfig.defaultLanguage));
};

/** Sorts tasks by status and display order. */
export const sortTaskOrder = (
  task1: Pick<Task, 'status' | 'displayOrder'>,
  task2: Pick<Task, 'status' | 'displayOrder'>,
  reverse = false,
) => {
  // Primary sort by status (lower status first)
  if (task1.status !== task2.status) return task1.status - task2.status;

  // Secondary sort by displayOrder within the same status
  return reverse ? task1.displayOrder - task2.displayOrder : task2.displayOrder - task1.displayOrder;
};
