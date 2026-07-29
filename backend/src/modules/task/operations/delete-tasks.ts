import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
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

  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    const tasksToDelete = await deleteTasksByIds(txCtx, { ids: allowedIds, deletedAt, deletedBy });
    // Lifecycle cascade: the attachment module soft-deletes the tasks' attachments in the same
    // transaction; the deleted task rows carry the deletedAt/deletedBy for it to reuse.
    await dispatchMutation(txCtx, 'task.deleted', { before: tasksToDelete });
  });

  return { success: true, data: { data: [], rejectedIds } };
}
