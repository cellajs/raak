import type { AuthContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { deleteWorkspacesByIds } from '#/modules/workspace/workspace-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { log } from '#/utils/logger';

export async function deleteWorkspacesOp(ctx: AuthContext, ids: string[]) {
  const toDeleteIds = Array.isArray(ids) ? ids : [ids];
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'workspace', toDeleteIds);
  await deleteWorkspacesByIds(ctx, { ids: allowedIds });

  // Invalidate membership cache so deleted memberships are absent from later reads.
  invalidateCache.user(ctx.var.user.id);

  log.info('Workspaces deleted', { count: allowedIds.length, ids: allowedIds });
  return { data: [], rejectedIds };
}
