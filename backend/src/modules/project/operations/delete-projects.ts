import type { UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { deleteProjectsByIds } from '#/modules/project/project-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { log } from '#/utils/logger';

export async function deleteProjectsOp(ctx: UserContext, ids: string[]) {
  const toDeleteIds = Array.isArray(ids) ? ids : [ids];
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'project', toDeleteIds);
  await deleteProjectsByIds(ctx, { ids: allowedIds });

  // The caller's cached memberships still hold the deleted projects' rows.
  invalidateCache.user(ctx.var.user.id);

  log.info('Projects deleted', { count: allowedIds.length, ids: allowedIds });
  return { data: [], rejectedIds };
}
