import type { z } from '@hono/zod-openapi';
import { generateId } from 'shared/entity-id';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { OperationResult } from '#/core/operation-result';
import { createServerStx } from '#/core/stx';
import { tenantContext } from '#/db/tenant-context';
import { findChatById, insertMessage } from '#/modules/agent/agent-queries';
import type { messageCreateBodySchema } from '#/modules/agent/agent-schema';
import type { MessageModel } from '#/modules/agent/messages-db';
import { getIsoDate } from '#/utils/iso-date';

type SendMessageInput = z.infer<typeof messageCreateBodySchema>;

export async function sendMessageOp(
  ctx: AuthContext,
  chatId: string,
  input: SendMessageInput,
): Promise<OperationResult<MessageModel>> {
  const { userId, organizationId, tenantId } = ctx.var;

  const message = await tenantContext(ctx, async (txCtx) => {
    const chat = await findChatById(txCtx, chatId);
    if (!chat) throw new AppError(404, 'not_found', 'warn', { entityType: 'chat' });
    if (chat.userId !== userId) throw new AppError(403, 'forbidden', 'warn', { entityType: 'chat' });

    return insertMessage(txCtx, {
      id: generateId(),
      entityType: 'message',
      name: '',
      tenantId,
      organizationId,
      chatId,
      userId,
      role: 'user',
      parts: [{ type: 'text', content: input.content }],
      status: 'complete',
      createdAt: getIsoDate(),
      createdBy: userId,
      stx: createServerStx(),
    });
  });

  return { success: true, data: message };
}
