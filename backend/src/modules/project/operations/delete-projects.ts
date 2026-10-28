import type { UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { deleteProjectsByIds } from '#/modules/project/project-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { log } from '#/utils/logger';

/**
 * Deletes the projects the caller may delete, with everything in them.
 * @returns The ids the caller may not delete, as `rejectedIds`.
 */
export async function deleteProjectsOp(ctx: UserContext, ids: string[]) {
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'project', ids);

  await deleteProjectsByIds(ctx, { ids: allowedIds });

  // The caller's next request reads their memberships without the deleted ones
  invalidateCache.user(ctx.var.user.id);

  log.info('Projects deleted', { count: allowedIds.length, ids: allowedIds });

  return { data: [], rejectedIds };
}
