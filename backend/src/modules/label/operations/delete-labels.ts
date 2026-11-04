import type { ActorContext } from '#/core/context';
import { createServerStx } from '#/core/stx/create-server-stx';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { labelsTable } from '#/modules/label/label-db';
import { deleteLabelsByIds } from '#/modules/label/label-queries';
import { filterPrimaryLabelDeletes } from '#/modules/label/operations/filter-primary-label-deletes';
import { reassignTasksFromDeletedPrimaries } from '#/modules/task/task-queries';
import type { StxBase } from '#/schemas/sync-transaction-schemas';
import { splitDeleteByPermission } from '#/utils/idempotency';

/**
 * Soft-deletes the labels the caller may delete, stamping each row with the delete's `stx`, keeping each project's last primary label, and moves the tasks of a
 * deleted primary label to another one. A delete sent again answers as its first attempt did: the rows that attempt removed count as deleted.
 * @returns The ids the caller may not delete or the primary-label rules keep, as `rejectedIds`.
 */
export async function deleteLabelsOp(
  ctx: ActorContext,
  ids: string[],
  stx: Pick<StxBase, 'mutationId' | 'sourceId'> = createServerStx(),
): Promise<{ data: []; rejectedIds: string[] }> {
  const { allowedIds: permittedIds, rejectedIds } = await splitDeleteByPermission(ctx, labelsTable, 'label', ids, stx);
  if (!permittedIds.length) return { data: [], rejectedIds };

  const actorId = ctx.var.actor.id;
  const rejected = new Set(rejectedIds);

  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    const { allowedIds, deletedPrimaryIds } = await filterPrimaryLabelDeletes(txCtx, permittedIds, rejected);

    const deleted = await deleteLabelsByIds(txCtx, { ids: allowedIds, actorId, stx });
    // Inside the transaction: the collaborative documents of epic descriptions go with them.
    await dispatchMutation(txCtx, 'label.deleted', { before: deleted });

    // Tasks reference exactly one primary label (NOT NULL), so reassignment happens in-transaction
    await reassignTasksFromDeletedPrimaries(txCtx, { deletedPrimaryIds, updatedBy: actorId });
  });

  return { data: [], rejectedIds: [...rejected] };
}
