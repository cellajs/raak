import type { z } from '@hono/zod-openapi';
import { generateId } from 'shared/entity-id';
import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { createServerStx } from '#/core/stx';
import { tenantContext } from '#/db/tenant-context';
import { insertChat, insertMessage } from '#/modules/agent/agent-queries';
import type { chatCreateBodySchema } from '#/modules/agent/agent-schema';
import type { ChatModel } from '#/modules/agent/chats-db';
import { getIsoDate } from '#/utils/iso-date';

type CreateChatInput = z.infer<typeof chatCreateBodySchema>;

export async function createChatOp(ctx: AuthContext, input: CreateChatInput): Promise<OperationResult<ChatModel>> {
  const { userId, organizationId, tenantId } = ctx.var;
  const now = getIsoDate();
  const chatId = generateId();
  const messageId = generateId();

  const chat = await tenantContext(ctx, async (txCtx) => {
    const inserted = await insertChat(txCtx, {
      id: chatId,
      entityType: 'chat',
      name: input.content.slice(0, 100),
      tenantId,
      organizationId,
      userId,
      model: '',
      createdAt: now,
      createdBy: userId,
      stx: createServerStx(),
    });

    await insertMessage(txCtx, {
      id: messageId,
      entityType: 'message',
      name: '',
      tenantId,
      organizationId,
      chatId,
      userId,
      role: 'user',
      parts: [{ type: 'text', content: input.content }],
      status: 'complete',
      createdAt: now,
      createdBy: userId,
      stx: createServerStx(),
    });

    return inserted;
  });

  return { success: true, data: chat };
}
