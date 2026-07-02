import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import agentRoutes from '#/modules/agent/agent-routes';
import '#/modules/agent/agent-module';
import { streamChatResponse } from '#/modules/agent/stream-chat';
import { acquireStreamSlot } from '#/modules/agent/stream-concurrency';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

// LLM streaming endpoint — mounted only on the AI worker (kept off the main API
// so long-lived streams never occupy the API's connection pool, and to keep this
// route out of the generated OpenAPI spec / SDK).
// biome-ignore lint/suspicious/noExplicitAny: SSE streaming bypasses Hono typed response
app.openapi(agentRoutes.streamChat, async (ctx): Promise<any> => {
  const chatId = ctx.req.param('id');
  const release = acquireStreamSlot();
  return streamChatResponse(ctx, chatId, release);
});

// TODO: not wired yet — mount `agentWorkerHandlers` on the AI worker's app
// (e.g. in ai-worker-entry.ts) so the streaming endpoint is actually served.
export const agentWorkerHandlers = app;
