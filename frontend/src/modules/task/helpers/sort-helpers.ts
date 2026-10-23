import { appConfig } from 'shared';
import type { Task } from '~/modules/task/types';

export const getItemsSortedByName = <T extends { name: string }>(items: T[]): T[] => {
  return items.slice().sort((a, b) => a.name.localeCompare(b.name, appConfig.defaultLanguage));
};

export const compareTaskOrder = (a: Pick<Task, 'status' | 'displayOrder'>, b: Pick<Task, 'status' | 'displayOrder'>, reverse = false) => {
  if (a.status !== b.status) return a.status - b.status;

  return reverse ? a.displayOrder - b.displayOrder : b.displayOrder - a.displayOrder;
};
