import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
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

    // Lifecycle cascade (taskId is plain data): soft-delete the tasks' attachments in
    // the same transaction. Tombstones flow per attachment row — delta sync clients
    // need each one to drop cached rows.
    const deletedTaskIds = tasksToDelete.map((task) => task.id);
    if (deletedTaskIds.length > 0) {
      const cascaded = await txCtx.var.db
        .update(attachmentsTable)
        .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
        .where(
          and(
            inArray(attachmentsTable.taskId, deletedTaskIds),
            eq(attachmentsTable.organizationId, txCtx.var.organizationId),
            isNull(attachmentsTable.deletedAt),
          ),
        )
        .returning({ id: attachmentsTable.id });
      if (cascaded.length > 0) {
        log.info('Attachments cascade-deleted with tasks', { count: cascaded.length });
      }
    }
  });

  return { success: true, data: { data: [], rejectedIds } };
}
