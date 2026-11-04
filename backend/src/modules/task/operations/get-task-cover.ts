import type { DbContext } from '#/core/context';
import { AppError } from '#/core/error';
import { withActorRef } from '#/modules/actors/actor-refs';
import { generateCover } from '#/modules/task/helpers/canvas';
import { taskTitle } from '#/modules/task/helpers/task-title';
import { findLinkedTask, type TaskLinkRef } from '#/modules/task/task-queries';

/** The PNG cover of a task link: its title and its author, a service account included. */
export async function getTaskCoverOp(ctx: DbContext, ref: TaskLinkRef) {
  const found = await findLinkedTask(ctx, ref);
  if (!found) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });

  const task = await withActorRef(ctx, found);
  return generateCover({
    title: taskTitle(task),
    avatarUrl: task.createdBy?.thumbnailUrl || '',
    name: task.createdBy?.name || '',
  });
}
