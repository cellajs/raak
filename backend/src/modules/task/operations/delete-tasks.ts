import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { cascadeSoftDeleteHosted } from '#/modules/entities/helpers/cascade-hosted';
import { deleteTasksByIds } from '#/modules/task/task-queries';
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

    // Host cascade: soft-delete hosted rows (attachments) of the deleted tasks
    const deletedTaskIds = tasksToDelete.map((task) => task.id);
    const cascaded = await cascadeSoftDeleteHosted(txCtx, {
      hostType: 'task',
      hostIds: deletedTaskIds,
      deletedAt,
      deletedBy,
    });
    const cascadedCount = Object.values(cascaded).reduce((sum, hostedIds) => sum + hostedIds.length, 0);
    if (cascadedCount > 0) {
      log.info('Hosted rows cascade-deleted with tasks', { count: cascadedCount });
    }
  });

  return { success: true, data: { data: [], rejectedIds } };
}
