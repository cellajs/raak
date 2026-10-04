import { z } from '@hono/zod-openapi';
import { createXRoutes, json, xRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { mockProjectResponse } from '#/modules/project/project-mocks';
import { projectSchema } from '#/modules/project/project-schema';
import { slugQuerySchema, validIdSchema } from '#/schemas';

const publicProjectRoutes = createXRoutes(['projects', 'app', 'channel'], {
  getPublicProject: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    summary: 'Fetch public project by ID',
    description: 'Retrieves a public project by ID. Pass ?slug=true to resolve by slug instead.',
    request: { params: z.object({ id: validIdSchema }), query: slugQuerySchema },
    responses: {
      200: json('Project without membership public', projectSchema.extend({ membership: z.null() }), { ...mockProjectResponse(), membership: null }),
    },
  }),
});

export { publicProjectRoutes };
