import { z } from '@hono/zod-openapi';
import { createXRoutes, errors, json, xRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { syncReadLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockTaskLinkResponse } from '#/modules/task/task-mocks';
import { taskLinkSchema } from '#/modules/task/task-schema';
import { validIdSchema } from '#/schemas';

const taskRedirectRoutes = createXRoutes(['tasks', 'app', 'product'], {
  redirectToTask: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    xRateLimiter: [syncReadLimiter],
    summary: 'Redirect to task',
    description: 'Redirects to the canonical route for a task by ID.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: { 200: { description: 'Success' }, ...errors(404) },
  }),
  resolveTaskLink: xRoute({
    method: 'get',
    path: '/{id}/resolve',
    xGuard: [publicGuard],
    xRateLimiter: [syncReadLimiter],
    summary: 'Resolve task link',
    description: 'Returns routing metadata for a task link so the frontend can decide where to redirect the user.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: {
      200: json('Task link resolution data', taskLinkSchema, mockTaskLinkResponse()),
      ...errors(404),
    },
  }),
  getTaskCover: xRoute({
    method: 'get',
    path: '/{id}/cover',
    xGuard: [publicGuard],
    xRateLimiter: [syncReadLimiter],
    summary: 'Get task cover',
    description: 'Retrieves the cover image for a task by ID.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: { 200: { description: 'Success' }, ...errors(404) },
  }),
});

export { taskRedirectRoutes };
