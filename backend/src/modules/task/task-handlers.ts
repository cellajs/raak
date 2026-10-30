import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { createTasksOp } from '#/modules/task/operations/create-tasks';
import { deleteTasksOp } from '#/modules/task/operations/delete-tasks';
import { getTaskOp } from '#/modules/task/operations/get-task';
import { getTasksOp } from '#/modules/task/operations/get-tasks';
import { getUnseenTaskIdsOp } from '#/modules/task/operations/get-unseen-task-ids';
import { updateTaskOp } from '#/modules/task/operations/update-task';
import { taskRoutes } from '#/modules/task/task-routes';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(taskRoutes.createTasks, async (ctx) => {
  const { created, ...result } = await createTasksOp(ctx, ctx.req.valid('json'));
  return ctx.json(result, created ? 201 : 200);
});

app.openapi(taskRoutes.getTasks, async (ctx) => {
  const result = await getTasksOp(ctx, ctx.req.valid('query'));
  return ctx.json(result, 200);
});

// Before getTask, whose `/{id}` would take "unseen" for an id.
app.openapi(taskRoutes.getUnseenTaskIds, async (ctx) => {
  const result = await getUnseenTaskIdsOp(ctx);
  return ctx.json(result, 200);
});

app.openapi(taskRoutes.getTask, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const result = await getTaskOp(ctx, id);
  ctx.set('productCacheData', result);
  return ctx.json(result, 200);
});

app.openapi(taskRoutes.updateTask, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { fullResponse } = ctx.req.valid('query');
  const result = await updateTaskOp(ctx, id, ctx.req.valid('json'), { fullResponse });
  return ctx.json(result, 200);
});

app.openapi(taskRoutes.deleteTasks, async (ctx) => {
  const { ids, stx } = ctx.req.valid('json');
  const result = await deleteTasksOp(ctx, ids, stx);
  return ctx.json(result, 200);
});

export const taskHandlers = app;
