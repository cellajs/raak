import type { AuthContext } from '#/core/context';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { filterPrimaryLabelDeletes, reassignTasksFromDeletedPrimaries } from '#/modules/label/helpers/primary-labels';
import { deleteCountersByKeys, deleteLabelsByIds } from '#/modules/label/label-queries';
import { splitByPermission } from '#/permissions/split-by-permission';
import { getIsoDate } from '#/utils/iso-date';

export async function deleteLabelsOp(ctx: AuthContext, ids: string[]): Promise<{ data: []; rejectedIds: string[] }> {
  const { allowedIds: permittedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'label', ids);
  const deletedAt = getIsoDate();
  const deletedBy = ctx.var.user.id;
  const rejected = new Set(rejectedIds);

  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    const { allowedIds, deletedPrimaryIds } = await filterPrimaryLabelDeletes(txCtx, permittedIds, rejected);

    await deleteLabelsByIds(txCtx, { ids: allowedIds, deletedAt, deletedBy });

    // Tasks reference exactly one primary label (NOT NULL), so reassignment happens in-transaction
    await reassignTasksFromDeletedPrimaries(txCtx, { deletedPrimaryIds, updatedBy: deletedBy });

    // Counter cleanup is best-effort; orphaned counters are harmless stale cache.
    await deleteCountersByKeys(txCtx, { keys: allowedIds });
  });

  return { data: [], rejectedIds: [...rejected] };
}
