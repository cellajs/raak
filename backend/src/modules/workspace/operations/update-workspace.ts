import type { AuthContext } from '#/core/context';
import { getEntityCounts } from '#/modules/entities/helpers/get-entity-counts';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { updateWorkspace } from '#/modules/workspace/workspace-queries';
import { workspaceContract } from '#/modules/workspace/workspace-schema';
import { getValidChannelEntity } from '#/permissions/get-channel-entity';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

export async function updateWorkspaceOp(ctx: AuthContext, id: string, rawInput: { name?: string }) {
  // Lens seam: canonicalize old-shape field names before any body access
  const input = workspaceContract.normalizeBody(rawInput);
  const user = ctx.var.user;

  const { entity: workspace, membership } = await getValidChannelEntity(ctx, id, 'workspace', 'update');

  const values = { ...input, updatedAt: getIsoDate(), updatedBy: user.id };
  const updatedWorkspaceRecord = await updateWorkspace(ctx, { id: workspace.id, values });

  log.info('Workspace updated', { workspaceId: updatedWorkspaceRecord.id });

  const counts = await getEntityCounts(ctx, workspace.entityType, workspace.id);
  const workspaceWithAudit = await withAuditUser(ctx, updatedWorkspaceRecord, user);
  const included = { ...(membership && { membership: toMembershipBase(membership) }), counts };

  return { ...workspaceWithAudit, included };
}
