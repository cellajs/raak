import type { ActorContext } from '#/core/context';
import { getChannelCounts } from '#/modules/entities/entities-queries';
import { isMembershipRow, toMembershipBase } from '#/modules/memberships/helpers/select';
import { withAuditUser } from '#/modules/user/operations/with-audit-users';
import { updateWorkspace } from '#/modules/workspace/workspace-queries';
import { workspaceContract } from '#/modules/workspace/workspace-schema';
import { getValidChannel } from '#/permissions/get-valid-channel';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

export async function updateWorkspaceOp(ctx: ActorContext, id: string, rawInput: { name?: string }) {
  // Lens seam: canonicalize old-shape field names before any body access
  const input = workspaceContract.normalizeBody(rawInput);

  const { entity: workspace, membership } = await getValidChannel(ctx, id, 'workspace', 'update');

  const values = { ...input, updatedAt: getIsoDate(), updatedBy: ctx.var.actor.id };
  const updatedWorkspaceRecord = await updateWorkspace(ctx, { id: workspace.id, values });

  log.info('Workspace updated', { workspaceId: updatedWorkspaceRecord.id });

  const counts = await getChannelCounts(ctx, { entityType: workspace.entityType, entityId: workspace.id });
  const workspaceWithAudit = await withAuditUser(ctx, updatedWorkspaceRecord);
  const included = { ...(membership && isMembershipRow(membership) && { membership: toMembershipBase(membership) }), counts };

  return { ...workspaceWithAudit, included };
}
