import { appConfig } from 'shared';
import type { Task } from '~/modules/task/types';

/** The share link of a task: by number once the server assigned one, else by id, which a task created offline has from the start. */
export const taskShareLink = ({ id, tenantId, number }: Pick<Task, 'id' | 'tenantId' | 'number'>) =>
  number > 0 ? `${appConfig.backendUrl}/t/${tenantId}/${number}` : `${appConfig.backendUrl}/t/${id}`;
