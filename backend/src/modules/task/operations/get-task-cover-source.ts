import type { DbContext } from '#/core/context';
import { AppError } from '#/core/error';
import { withActorRef } from '#/modules/actors/actor-refs';
import { taskTitle } from '#/modules/task/helpers/task-title';
import { findLiveTaskById } from '#/modules/task/task-queries';

/** What the cover image of a task draws: its title and its author, a service account included. */
export const getTaskCoverSource = async (ctx: DbContext, id: string) => {
  const found = await findLiveTaskById(ctx, { id });
  if (!found) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });

  const task = await withActorRef(ctx, found);
  return {
    title: taskTitle(task),
    avatarUrl: task.createdBy?.thumbnailUrl || '',
    name: task.createdBy?.name || '',
  };
};
