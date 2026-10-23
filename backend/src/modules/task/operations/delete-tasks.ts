import type { ActorContext } from '#/core/context';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { deleteTasksByIds } from '#/modules/task/task-queries';
import { splitByPermission } from '#/permissions/split-by-permission';

export async function deleteTasksOp(ctx: ActorContext, ids: string[]): Promise<{ data: []; rejectedIds: string[] }> {
  const { allowedIds, rejectedIds } = await splitByPermission(ctx, 'delete', 'task', ids);

  // Attachment cleanup for the deleted tasks' host arrays is handled asynchronously by
  // the CDC worker's owned-embedding GC (avoids attachment row locks during the request).
  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    const deleted = await deleteTasksByIds(txCtx, { ids: allowedIds, actorId: ctx.var.actor.id });
    // Inside the transaction: the collaborative documents of the rows go with them.
    await dispatchMutation(txCtx, 'task.deleted', { before: deleted });
  });

  return { data: [], rejectedIds };
}
