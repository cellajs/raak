import type { AuthContext } from '#/core/context';
import { deleteWorkspacesByIds } from '#/modules/workspace/workspace-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { logEvent } from '#/utils/logger';

export async function deleteWorkspacesOp(ctx: AuthContext, ids: string[]) {
  const toDeleteIds = Array.isArray(ids) ? ids : [ids];
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'workspace', toDeleteIds);
  await deleteWorkspacesByIds(ctx, { ids: allowedIds });
  logEvent(ctx, 'info', 'Workspaces deleted', { count: allowedIds.length, ids: allowedIds });
  return { data: [], rejectedIds };
}
