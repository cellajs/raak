import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContextIncludingDeleted } from '#/db/tenant-context';
import { deleteChatsByIds } from '#/modules/agent/agent-queries';
import { getIsoDate } from '#/utils/iso-date';

export async function deleteChatsOp(
  ctx: AuthContext,
  ids: string[],
): Promise<OperationResult<{ data: []; rejectedIds: string[] }>> {
  const deletedAt = getIsoDate();
  const deletedBy = ctx.var.user.id;

  await tenantContextIncludingDeleted(ctx, async (txCtx) => {
    await deleteChatsByIds(txCtx, { ids, deletedAt, deletedBy });
  });

  return { success: true, data: { data: [], rejectedIds: [] } };
}
