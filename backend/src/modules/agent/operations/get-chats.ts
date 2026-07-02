import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantRead, tenantReadIncludingDeleted } from '#/db/tenant-context';
import { findChatsByUser } from '#/modules/agent/agent-queries';
import type { chatListQuerySchema } from '#/modules/agent/agent-schema';
import type { ChatModel } from '#/modules/agent/chats-db';

type GetChatsInput = z.infer<typeof chatListQuerySchema>;

export async function getChatsOp(
  ctx: AuthContext,
  input: GetChatsInput,
): Promise<OperationResult<{ items: ChatModel[]; total: number }>> {
  const { userId } = ctx.var;

  // Delta sync (seqCursor) must see tombstones so the client can remove soft-deleted chats
  const read = input.seqCursor ? tenantReadIncludingDeleted : tenantRead;

  const result = await read(ctx, (readCtx) =>
    findChatsByUser(readCtx, {
      userId,
      archived: input.archived === 'true',
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
      order: input.order ?? 'desc',
      seqCursor: input.seqCursor,
    }),
  );

  return { success: true, data: result };
}
