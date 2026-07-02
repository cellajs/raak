import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { deleteCountersByKeys, deleteLabelsByIds } from '#/modules/label/label-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { getIsoDate } from '#/utils/iso-date';

export async function deleteLabelsOp(
  ctx: AuthContext,
  ids: string[],
): Promise<OperationResult<{ data: []; rejectedIds: string[] }>> {
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'label', ids);
  const deletedAt = getIsoDate();
  const deletedBy = ctx.var.user.id;

  // Label array cleanup on tasks is handled asynchronously by CDC when it
  // processes the label soft-delete events (avoids row locks on tasks during request).
  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    await deleteLabelsByIds(txCtx, { ids: allowedIds, deletedAt, deletedBy });
    // Counter cleanup is best-effort — orphaned counters are harmless stale cache
    await deleteCountersByKeys(txCtx, { keys: allowedIds });
  });

  return { success: true, data: { data: [], rejectedIds } };
}
