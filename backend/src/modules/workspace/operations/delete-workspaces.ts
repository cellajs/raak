import type { UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { ensureUserWorkspace } from '#/modules/workspace/operations/ensure-workspace';
import { deleteWorkspacesByIds, moveWorkspaceMemberships } from '#/modules/workspace/workspace-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { log } from '#/utils/logger';

/**
 * Deletes the workspaces the caller may delete, except the caller's own last one in the organization, which stays. The
 * project memberships filed under the deleted ones move to their holder's first other workspace, or a new one.
 * @returns The ids not deleted, as `rejectedIds`.
 */
export async function deleteWorkspacesOp(ctx: UserContext, ids: string[]) {
  const { user, organization, memberships } = ctx.var;
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'workspace', ids);

  const deletable = new Set(allowedIds);
  const mine = memberships
    .filter(({ channelType, organizationId }) => channelType === 'workspace' && organizationId === organization.id)
    .toSorted((a, b) => a.displayOrder - b.displayOrder);
  if (mine.length && mine.every(({ channelId }) => deletable.has(channelId))) deletable.delete(mine[0].channelId);
  const deletableIds = [...deletable];

  const holderIds = await ctx.var.db.transaction(async (tx) => {
    const txCtx = { var: { ...ctx.var, db: tx } };
    const userIds = await moveWorkspaceMemberships(txCtx, {
      ids: deletableIds,
      updatedBy: user.id,
      targetOf: (userId) => ensureUserWorkspace(txCtx, { userId, organizationId: organization.id, exceptIds: deletableIds }),
    });
    await deleteWorkspacesByIds(txCtx, { ids: deletableIds });
    return userIds;
  });

  // Every user whose memberships changed reads them anew on the next request, the caller among them
  for (const userId of new Set([user.id, ...holderIds])) invalidateCache.user(userId);

  log.info('Workspaces deleted', { count: deletableIds.length, ids: deletableIds });
  return { data: [], rejectedIds: [...rejectedIds, ...allowedIds.filter((id) => !deletable.has(id))] };
}
