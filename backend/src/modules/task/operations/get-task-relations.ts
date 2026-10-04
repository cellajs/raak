import type { ActorContext } from '#/core/context';
import type { TaskModel } from '#/modules/task/task-db';
import { findTaskRelations } from '#/modules/task/task-queries';

/** Fetch users and labels referenced by one or more tasks. */
export const getTaskRelations = async (ctx: ActorContext, { tasks }: { tasks: TaskModel[] }) => {
  const userIds = Array.from(new Set(tasks.flatMap((t) => [t.createdBy, t.updatedBy, ...t.assignedTo].filter((u) => u !== null))));
  const labelIds = Array.from(new Set(tasks.flatMap((t) => [...t.labels, t.primaryLabelId])));
  return findTaskRelations(ctx, { userIds, labelIds });
};
