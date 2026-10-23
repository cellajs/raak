import { appConfig } from 'shared';
import type { Task } from '~/modules/task/types';

export const getItemsSortedByName = <T extends { name: string }>(items: T[]): T[] => {
  // slice used so that the original array is not mutated
  return items.slice().sort((a, b) => a.name.localeCompare(b.name, appConfig.defaultLanguage));
};

export const compareTaskOrder = (a: Pick<Task, 'status' | 'displayOrder'>, b: Pick<Task, 'status' | 'displayOrder'>, reverse = false) => {
  // Primary sort by status (lower status first)
  if (a.status !== b.status) return a.status - b.status;

  // Secondary sort by displayOrder within the same status
  return reverse ? a.displayOrder - b.displayOrder : b.displayOrder - a.displayOrder;
};
