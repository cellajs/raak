import type { ActorContext } from '#/core/context';
import { findLiveLabelProjects } from '#/modules/label/label-queries';
import { findProjectMemberUserIds } from '#/modules/task/task-queries';

/**
 * What a task may store of `userIds` and `labelIds` in each of `projectIds`: an assignee must be a member of the task's
 * project, a label a live label of it. Labels are an embedding host column, so this is the stricter form of
 * `filterExistingProductIds` for them.
 * @returns Whether a task in `projectId` may store `id` in `column`.
 */
export const projectRelationFilter = async (
  ctx: ActorContext,
  { projectIds, userIds, labelIds }: { projectIds: string[]; userIds: string[]; labelIds: string[] },
) => {
  const [members, labels] = await Promise.all([
    findProjectMemberUserIds(ctx, { projectIds, userIds }),
    findLiveLabelProjects(ctx, { projectIds, ids: labelIds }),
  ]);
  const allowed = {
    assignedTo: new Set(members.map(({ projectId, userId }) => `${projectId}:${userId}`)),
    labels: new Set(labels.map(({ projectId, id }) => `${projectId}:${id}`)),
  };
  return (column: keyof typeof allowed, projectId: string, id: string) => allowed[column].has(`${projectId}:${id}`);
};
