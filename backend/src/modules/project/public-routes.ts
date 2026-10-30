import { z } from '@hono/zod-openapi';
import { createXRoutes, errors, json, xRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { syncReadLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockProjectResponse } from '#/modules/project/project-mocks';
import { projectSchema } from '#/modules/project/project-schema';
import { slugIncludeQuerySchema, validIdSchema } from '#/schemas';

const publicProjectRoutes = createXRoutes(['projects', 'app', 'channel'], {
  getPublicProject: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    xRateLimiter: [syncReadLimiter],
    summary: 'Fetch public project by ID',
    description: 'Retrieves a public project by ID. Pass ?slug=true to resolve by slug instead.',
    request: { params: z.object({ id: validIdSchema }), query: slugIncludeQuerySchema.pick({ slug: true }) },
    responses: {
      200: json('Public project', projectSchema.extend({ membership: z.null() }), { ...mockProjectResponse(), membership: null }),
      ...errors(404),
    },
  }),
});

export { publicProjectRoutes };
