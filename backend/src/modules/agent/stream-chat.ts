import { type ModelMessage, type StreamChunk, toServerSentEventsResponse } from '@tanstack/ai';
import { generateId } from 'shared/entity-id';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import { createServerStx } from '#/core/stx';
import { tenantContext, tenantRead } from '#/db/tenant-context';
import { findChatById, findMessagesByChat, insertMessage } from '#/modules/agent/agent-queries';
import { defaultModel, runModel } from '#/modules/agent/run-model';
import { buildSystemPrompt } from '#/modules/agent/system-prompt';
import { getIsoDate } from '#/utils/iso-date';

export async function streamChatResponse(ctx: AuthContext, chatId: string, onFinally?: () => void): Promise<Response> {
  try {
    // Verify the chat exists and belongs to the requesting user before streaming.
    await tenantRead(ctx, async (readCtx) => {
      const chat = await findChatById(readCtx, chatId);
      if (!chat) throw new AppError(404, 'not_found', 'warn', { entityType: 'chat' });
      if (chat.userId !== ctx.var.userId) throw new AppError(403, 'forbidden', 'warn', { entityType: 'chat' });
    });

    const systemPrompt = await buildSystemPrompt(ctx);
    const history = await loadChatHistory(ctx, chatId);

    // Run the AI capability layer (tool registry + model). The agent owns history + persistence.
    const stream = runModel(ctx, { messages: history, systemPrompts: [systemPrompt] });

    return toServerSentEventsResponse(persistAssistantMessage(ctx, chatId, stream, onFinally));
  } catch (error) {
    // Pre-stream failures (e.g. ownership) won't reach the generator's finally.
    onFinally?.();
    throw error;
  }
}

async function loadChatHistory(ctx: AuthContext, chatId: string): Promise<Array<ModelMessage<string | null>>> {
  const { items } = await tenantRead(ctx, (readCtx) =>
    findMessagesByChat(readCtx, { chatId, limit: 100, offset: 0, order: 'asc' }),
  );

  return items.map((msg): ModelMessage<string | null> => {
    const parts = (msg.parts ?? []) as Array<{ type: string; content?: string }>;
    const textContent = parts
      .filter((p) => p.type === 'text')
      .map((p) => p.content ?? '')
      .join('');

    return {
      role: msg.role as 'user' | 'assistant' | 'tool',
      content: textContent || null,
    };
  });
}

interface CollectedParts {
  type: string;
  content?: string;
  [key: string]: unknown;
}

async function* persistAssistantMessage(
  ctx: AuthContext,
  chatId: string,
  stream: AsyncIterable<StreamChunk>,
  onFinally?: () => void,
): AsyncIterable<StreamChunk> {
  const assistantMessages = new Map<string, string>();
  let latestAssistantMessageId: string | null = null;
  let model: string | undefined;

  try {
    for await (const chunk of stream) {
      if (chunk.model) {
        model = chunk.model;
      }

      if (chunk.type === 'TEXT_MESSAGE_START' && chunk.role === 'assistant') {
        assistantMessages.set(chunk.messageId, '');
        latestAssistantMessageId = chunk.messageId;
      }

      if (chunk.type === 'TEXT_MESSAGE_CONTENT') {
        const currentText = assistantMessages.get(chunk.messageId);
        if (currentText !== undefined) {
          assistantMessages.set(chunk.messageId, `${currentText}${chunk.delta}`);
        }
      }

      yield chunk;
    }

    const latestText = latestAssistantMessageId ? assistantMessages.get(latestAssistantMessageId) : null;
    if (!latestText?.trim()) {
      return;
    }

    const parts: CollectedParts[] = [{ type: 'text', content: latestText }];
    const { userId, organizationId, tenantId } = ctx.var;

    try {
      await tenantContext(ctx, (txCtx) =>
        insertMessage(txCtx, {
          id: generateId(),
          entityType: 'message',
          name: '',
          tenantId,
          organizationId,
          chatId,
          userId,
          role: 'assistant',
          parts,
          model: model ?? defaultModel,
          status: 'complete',
          createdAt: getIsoDate(),
          createdBy: userId,
          stx: createServerStx(),
        }),
      );
    } catch (error) {
      console.error('[agent] Failed to persist assistant message:', error);
    }
  } finally {
    onFinally?.();
  }
}
