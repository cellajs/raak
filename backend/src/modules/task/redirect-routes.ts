import { z } from '@hono/zod-openapi';
import { createXRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { errorResponseRefs, validIdSchema } from '#/schemas';

const taskRedirectRoutes = {
  redirectToTask: createXRoute({
    method: 'get',
    path: '/{id}',
    tags: ['tasks', 'app', 'product'],
    xGuard: [publicGuard],
    operationId: 'redirectToTask',
    summary: 'Redirect to task',
    description: 'Redirects to the canonical route for a task by ID.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: { 200: { description: 'Success' }, ...errorResponseRefs },
  }),
  resolveTaskLink: createXRoute({
    method: 'get',
    path: '/{id}/resolve',
    tags: ['tasks', 'app', 'product'],
    xGuard: [publicGuard],
    operationId: 'resolveTaskLink',
    summary: 'Resolve task link',
    description: 'Returns routing metadata for a task link so the frontend can decide where to redirect the user.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: {
      200: {
        description: 'Task link resolution data',
        content: {
          'application/json': {
            schema: z.object({
              taskId: z.string(),
              projectId: z.string(),
              projectSlug: z.string(),
              organizationId: z.string(),
              organizationSlug: z.string(),
              tenantId: z.string(),
              publicAt: z.string().nullable(),
            }),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  getTaskCover: createXRoute({
    method: 'get',
    path: '/{id}/cover',
    xGuard: [publicGuard],
    tags: ['tasks', 'app', 'product'],
    operationId: 'getTaskCover',
    summary: 'Get task cover',
    description: 'Retrieves the cover image for a task by ID.',
    request: {
      params: z.object({
        id: validIdSchema,
      }),
    },
    responses: {
      200: { description: 'Success' },
      ...errorResponseRefs,
    },
  }),
};

export default taskRedirectRoutes;
