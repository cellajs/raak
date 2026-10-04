import { z } from '@hono/zod-openapi';
import { createXRoutes, json, xRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { validIdSchema } from '#/schemas';

const taskRedirectRoutes = createXRoutes(['tasks', 'app', 'product'], {
  redirectToTask: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    summary: 'Redirect to task',
    description: 'Redirects to the canonical route for a task by ID.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: { 200: { description: 'Success' } },
  }),
  resolveTaskLink: xRoute({
    method: 'get',
    path: '/{id}/resolve',
    xGuard: [publicGuard],
    summary: 'Resolve task link',
    description: 'Returns routing metadata for a task link so the frontend can decide where to redirect the user.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: {
      200: json(
        'Task link resolution data',
        z.object({
          taskId: z.string(),
          projectId: z.string(),
          projectSlug: z.string(),
          organizationId: z.string(),
          organizationSlug: z.string(),
          tenantId: z.string(),
          publicAt: z.string().nullable(),
        }),
      ),
    },
  }),
  getTaskCover: xRoute({
    method: 'get',
    path: '/{id}/cover',
    xGuard: [publicGuard],
    summary: 'Get task cover',
    description: 'Retrieves the cover image for a task by ID.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: { 200: { description: 'Success' } },
  }),
});

export { taskRedirectRoutes };
