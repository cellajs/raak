import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { getPublicTaskOp } from '#/modules/task/operations/get-public-task';
import { getPublicTasksOp } from '#/modules/task/operations/get-public-tasks';
import { publicTaskRoutes } from '#/modules/task/public-routes';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(publicTaskRoutes.getPublicTask, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const result = await getPublicTaskOp(ctx, id);
  return ctx.json(result, 200);
});

app.openapi(publicTaskRoutes.getPublicTasks, async (ctx) => {
  const result = await getPublicTasksOp(ctx.req.valid('query'));
  return ctx.json(result, 200);
});

export const publicTaskHandlers = app;
