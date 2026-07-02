import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { assertSuccess } from '#/core/operation-result';
import agentRoutes from '#/modules/agent/agent-routes';
import '#/modules/agent/agent-module';
import { createChatOp } from '#/modules/agent/operations/create-chat';
import { deleteChatsOp } from '#/modules/agent/operations/delete-chats';
import { getChatsOp } from '#/modules/agent/operations/get-chats';
import { getMessagesOp } from '#/modules/agent/operations/get-messages';
import { sendMessageOp } from '#/modules/agent/operations/send-message';
import { updateChatOp } from '#/modules/agent/operations/update-chat';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(agentRoutes.createChat, async (ctx) => {
  const { content } = ctx.req.valid('json');
  const result = await createChatOp(ctx, { content });
  assertSuccess(result, 'chat');
  return ctx.json(result.data, 200);
});

app.openapi(agentRoutes.getChats, async (ctx) => {
  const result = await getChatsOp(ctx, ctx.req.valid('query'));
  assertSuccess(result, 'chat');
  return ctx.json(result.data, 200);
});

app.openapi(agentRoutes.getMessages, async (ctx) => {
  const id = ctx.req.param('id');
  const result = await getMessagesOp(ctx, id, ctx.req.valid('query'));
  assertSuccess(result, 'message');
  return ctx.json(result.data, 200);
});

app.openapi(agentRoutes.sendMessage, async (ctx) => {
  const { content } = ctx.req.valid('json');
  const chatId = ctx.req.param('id');
  const result = await sendMessageOp(ctx, chatId, { content });
  assertSuccess(result, 'message');
  return ctx.json(result.data, 200);
});

app.openapi(agentRoutes.updateChat, async (ctx) => {
  const id = ctx.req.param('id');
  const result = await updateChatOp(ctx, id, ctx.req.valid('json'));
  assertSuccess(result, 'chat');
  return ctx.json(result.data, 200);
});

app.openapi(agentRoutes.deleteChats, async (ctx) => {
  const { ids } = ctx.req.valid('json');
  const result = await deleteChatsOp(ctx, Array.isArray(ids) ? ids : [ids]);
  assertSuccess(result, 'chat');
  return ctx.json(result.data, 200);
});

export const agentHandlers = app;
