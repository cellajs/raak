import type { ActorBinding, ActorContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { getChannelCounts } from '#/modules/entities/entities-queries';
import { isMembershipRow, toMembershipBase } from '#/modules/memberships/helpers/select';
import type { ProjectModel } from '#/modules/project/project-db';
import { getTaskStatusCounts } from '#/modules/task/operations/get-task-status-counts';

/**
 * A project as it reads on the wire: its writers as references, and in `included` its counts with the task status
 * counts and the caller's membership when asked for.
 * @param grant - The caller's grant on the project. A service account's grant is not a membership row, so only a user's
 * row is returned.
 */
export async function toProjectResponse(
  ctx: ActorContext,
  project: ProjectModel,
  grant: ActorBinding | null,
  include: { counts: boolean; membership: boolean },
) {
  const [counts, taskStatusCounts, projectWithAudit] = await Promise.all([
    include.counts ? getChannelCounts(ctx, { entityType: 'project', entityId: project.id }) : undefined,
    include.counts ? getTaskStatusCounts(ctx, project.id) : undefined,
    withActorRef(ctx, project),
  ]);
  const membership = include.membership && grant && isMembershipRow(grant) ? toMembershipBase(grant) : undefined;
  return {
    ...projectWithAudit,
    included: { ...(membership && { membership }), ...(counts && taskStatusCounts && { counts: { ...counts, taskStatusCounts } }) },
  };
}
