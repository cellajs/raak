import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { assertSuccess } from '#/core/operation-result';
import { createTasksOp } from '#/modules/task/operations/create-tasks';
import { deleteTasksOp } from '#/modules/task/operations/delete-tasks';
import { getTaskOp } from '#/modules/task/operations/get-task';
import { getTasksOp } from '#/modules/task/operations/get-tasks';
import { updateTaskOp } from '#/modules/task/operations/update-task';
import { taskRoutes } from '#/modules/task/task-routes';
import '#/modules/task/task-module';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(taskRoutes.createTasks, async (ctx) => {
  const result = await createTasksOp(ctx, ctx.req.valid('json'));
  assertSuccess(result, 'task');
  return ctx.json(result.data, 201);
});

app.openapi(taskRoutes.getTasks, async (ctx) => {
  const result = await getTasksOp(ctx, ctx.req.valid('query'));
  assertSuccess(result, 'task');
  return ctx.json(result.data, 200);
});

app.openapi(taskRoutes.getTask, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const result = await getTaskOp(ctx, id);
  assertSuccess(result, 'task');
  ctx.set('productCacheData', result.data);
  return ctx.json(result.data, 200);
});

app.openapi(taskRoutes.updateTask, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { fullResponse } = ctx.req.valid('query');
  const result = await updateTaskOp(ctx, id, ctx.req.valid('json'), { fullResponse });
  assertSuccess(result, 'task');
  return ctx.json(result.data, 200);
});

app.openapi(taskRoutes.deleteTasks, async (ctx) => {
  const { ids } = ctx.req.valid('json');
  const result = await deleteTasksOp(ctx, Array.isArray(ids) ? ids : [ids]);
  assertSuccess(result, 'task');
  return ctx.json(result.data, 200);
});

export const taskHandlers = app;
