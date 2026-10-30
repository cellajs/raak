import { z } from '@hono/zod-openapi';
import { createXRoutes, errors, json, xRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { syncReadLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockTasksResponse } from '#/modules/task/task-mocks';
import { publicTaskListQuerySchema, taskSchema } from '#/modules/task/task-schema';
import { paginationSchema, validIdSchema } from '#/schemas';

const publicTaskRoutes = createXRoutes(['tasks', 'app', 'product'], {
  getPublicTask: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    xRateLimiter: [syncReadLimiter],
    summary: 'Get public task',
    description: 'Retrieves a public task by its ID.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: { 200: json('Task', taskSchema), ...errors(403, 404) },
  }),
  getPublicTasks: xRoute({
    method: 'get',
    path: '/',
    xGuard: [publicGuard],
    xRateLimiter: [syncReadLimiter],
    summary: 'Get public tasks',
    description: 'Returns a list of public tasks associated with a specific project. For publicly shared boards.',
    request: { query: publicTaskListQuerySchema },
    responses: { 200: json('Tasks', paginationSchema(taskSchema), mockTasksResponse()), ...errors(404) },
  }),
});

export { publicTaskRoutes };
