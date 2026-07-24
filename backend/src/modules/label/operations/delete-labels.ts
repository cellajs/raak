import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { filterPrimaryLabelDeletes, reassignTasksFromDeletedPrimaries } from '#/modules/label/helpers/primary-labels';
import { deleteCountersByKeys, deleteLabelsByIds } from '#/modules/label/label-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { getIsoDate } from '#/utils/iso-date';

export async function deleteLabelsOp(
  ctx: AuthContext,
  ids: string[],
): Promise<OperationResult<{ data: []; rejectedIds: string[] }>> {
  const { allowedIds: permittedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'label', ids);
  const deletedAt = getIsoDate();
  const deletedBy = ctx.var.user.id;
  const rejected = new Set(rejectedIds);

  // Label array cleanup on tasks is handled asynchronously by CDC when it
  // processes the label soft-delete events (avoids row locks on tasks during request).
  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    // Primary labels additionally require project-admin authority and a min-1 floor per project
    const { allowedIds, deletedPrimaryIds } = await filterPrimaryLabelDeletes(txCtx, permittedIds, rejected);
    await deleteLabelsByIds(txCtx, { ids: allowedIds, deletedAt, deletedBy });
    // Tasks reference exactly one primary label (NOT NULL), so reassignment happens in-transaction
    await reassignTasksFromDeletedPrimaries(txCtx, { deletedPrimaryIds, updatedBy: deletedBy });
    // Counter cleanup is best-effort; orphaned counters are harmless stale cache.
    await deleteCountersByKeys(txCtx, { keys: allowedIds });
  });

  return { success: true, data: { data: [], rejectedIds: [...rejected] } };
}
