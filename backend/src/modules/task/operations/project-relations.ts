import type { ActorContext } from '#/core/context';
import { findLiveLabelProjects } from '#/modules/label/label-queries';
import { findProjectMemberUserIds } from '#/modules/task/task-queries';

/**
 * What a task may store of `userIds` and `labelIds` in each of `projectIds`: an assignee must be a member of the task's
 * project or the acting user, a label a live label of it. Labels are an embedding host column, so this is the stricter
 * form of `filterExistingProductIds` for them.
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
  const { actor } = ctx.var;
  return (column: keyof typeof allowed, projectId: string, id: string) =>
    // The actor already holds the grant on the task it writes, so it may assign itself without a project membership
    (column === 'assignedTo' && actor.kind === 'user' && id === actor.id) || allowed[column].has(`${projectId}:${id}`);
};
