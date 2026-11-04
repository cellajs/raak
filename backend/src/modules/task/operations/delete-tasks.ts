import type { ActorContext } from '#/core/context';
import { createServerStx } from '#/core/stx/create-server-stx';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { tasksTable } from '#/modules/task/task-db';
import { deleteTasksByIds } from '#/modules/task/task-queries';
import type { StxBase } from '#/schemas/sync-transaction-schemas';
import { splitDeleteByPermission } from '#/utils/idempotency';

/**
 * Soft-deletes the tasks the caller may delete, stamping each row with the delete's `stx`. A delete sent again answers as
 * its first attempt did: the rows that attempt removed count as deleted.
 * @param stx - The ids the client sent with the delete; a server stx when it sent none.
 * @returns The ids the caller may not delete, as `rejectedIds`.
 */
export async function deleteTasksOp(
  ctx: ActorContext,
  ids: string[],
  stx: Pick<StxBase, 'mutationId' | 'sourceId'> = createServerStx(),
): Promise<{ data: []; rejectedIds: string[] }> {
  const { allowedIds, rejectedIds } = await splitDeleteByPermission(ctx, tasksTable, 'task', ids, stx);
  if (!allowedIds.length) return { data: [], rejectedIds };

  // Attachment cleanup for the deleted tasks' host arrays is handled asynchronously by
  // the CDC worker's owned-embedding GC (avoids attachment row locks during the request).
  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    const deleted = await deleteTasksByIds(txCtx, { ids: allowedIds, actorId: ctx.var.actor.id, stx });
    // Inside the transaction: the collaborative documents of the rows go with them.
    await dispatchMutation(txCtx, 'task.deleted', { before: deleted });
  });

  return { data: [], rejectedIds };
}
