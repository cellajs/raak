import type { AuthContext } from '#/core/context';
import { deleteProjectsByIds } from '#/modules/project/project-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { logEvent } from '#/utils/logger';

export async function deleteProjectsOp(ctx: AuthContext, ids: string[]) {
  // Convert the ids to an array
  const toDeleteIds = Array.isArray(ids) ? ids : [ids];

  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'project', toDeleteIds);

  // Delete the projects
  await deleteProjectsByIds(ctx, { ids: allowedIds });

  logEvent(ctx, 'info', 'Projects deleted', { count: allowedIds.length, ids: allowedIds });

  return { data: [], rejectedIds };
}
