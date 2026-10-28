import type { UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { deleteWorkspacesByIds } from '#/modules/workspace/workspace-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { log } from '#/utils/logger';

/**
 * Deletes the workspaces the caller may delete.
 * @returns The ids the caller may not delete, as `rejectedIds`.
 */
export async function deleteWorkspacesOp(ctx: UserContext, ids: string[]) {
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'workspace', ids);
  await deleteWorkspacesByIds(ctx, { ids: allowedIds });

  // The caller's next request reads their memberships without the deleted ones
  invalidateCache.user(ctx.var.user.id);

  log.info('Workspaces deleted', { count: allowedIds.length, ids: allowedIds });
  return { data: [], rejectedIds };
}
