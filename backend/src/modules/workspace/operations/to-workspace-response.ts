import type { ActorBinding, DbContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { getChannelCounts } from '#/modules/entities/entities-queries';
import { isMembershipRow, toMembershipBase } from '#/modules/memberships/helpers/select';
import type { WorkspaceModel } from '#/modules/workspace/workspace-db';

/**
 * A workspace as it reads on the wire: its writers as references, and in `included` its counts and the caller's
 * membership when asked for.
 * @param grant - The caller's grant on the workspace. A service account's grant is not a membership row, so only a
 * user's row is returned.
 */
export async function toWorkspaceResponse(
  ctx: DbContext,
  workspace: WorkspaceModel,
  grant: ActorBinding | null,
  include: { counts: boolean; membership: boolean },
) {
  const [counts, workspaceWithAudit] = await Promise.all([
    include.counts ? getChannelCounts(ctx, { entityType: 'workspace', entityId: workspace.id }) : undefined,
    withActorRef(ctx, workspace),
  ]);
  const membership = include.membership && grant && isMembershipRow(grant) ? toMembershipBase(grant) : undefined;
  return { ...workspaceWithAudit, included: { ...(membership && { membership }), ...(counts && { counts }) } };
}
