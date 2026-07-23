import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { deleteTasksByIds } from '#/modules/task/task-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { getIsoDate } from '#/utils/iso-date';

export async function deleteTasksOp(
  ctx: AuthContext,
  ids: string[],
): Promise<OperationResult<{ data: []; rejectedIds: string[] }>> {
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'task', ids);
  const deletedAt = getIsoDate();
  const deletedBy = ctx.var.user.id;

  // Attachment cleanup for the deleted tasks' host arrays is handled asynchronously by
  // the CDC worker's owned-embedding GC (avoids attachment row locks during the request).
  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    await deleteTasksByIds(txCtx, { ids: allowedIds, deletedAt, deletedBy });
  });

  return { success: true, data: { data: [], rejectedIds } };
}
