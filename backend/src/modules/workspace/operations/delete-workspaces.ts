import type { UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { deleteWorkspacesByIds, unfileWorkspaceMemberships } from '#/modules/workspace/workspace-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { log } from '#/utils/logger';

/**
 * Deletes the workspaces the caller may delete. The project memberships filed under them stay, out of any workspace.
 * @returns The ids the caller may not delete, as `rejectedIds`.
 */
export async function deleteWorkspacesOp(ctx: UserContext, ids: string[]) {
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'workspace', ids);

  const holderIds = await ctx.var.db.transaction(async (tx) => {
    const txCtx = { var: { ...ctx.var, db: tx } };
    const userIds = await unfileWorkspaceMemberships(txCtx, { ids: allowedIds, updatedBy: ctx.var.user.id });
    await deleteWorkspacesByIds(txCtx, { ids: allowedIds });
    return userIds;
  });

  // Every user whose memberships changed reads them anew on the next request, the caller among them
  for (const userId of new Set([ctx.var.user.id, ...holderIds])) invalidateCache.user(userId);

  log.info('Workspaces deleted', { count: allowedIds.length, ids: allowedIds });
  return { data: [], rejectedIds };
}
