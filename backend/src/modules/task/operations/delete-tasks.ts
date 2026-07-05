import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { deleteAttachmentsByGroupIds, deleteTasksByIds } from '#/modules/task/task-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

export async function deleteTasksOp(
  ctx: AuthContext,
  ids: string[],
): Promise<OperationResult<{ data: []; rejectedIds: string[] }>> {
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'task', ids);
  const deletedAt = getIsoDate();
  const deletedBy = ctx.var.user.id;

  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    const tasksToDelete = await deleteTasksByIds(txCtx, { ids: allowedIds, deletedAt, deletedBy });

    // Soft-delete associated attachments via groupId (best-effort cleanup)
    const deletedTaskIds = tasksToDelete.map((task) => task.id);
    if (deletedTaskIds.length > 0) {
      const deletedAttachments = await deleteAttachmentsByGroupIds(txCtx, {
        groupIds: deletedTaskIds,
        deletedAt,
        deletedBy,
      });
      if (deletedAttachments.length > 0) {
        log.info(ctx, 'Task attachments deleted', { count: deletedAttachments.length });
      }
    }
  });

  return { success: true, data: { data: [], rejectedIds } };
}
