import { z } from '@hono/zod-openapi';
import { createXRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { mockProjectResponse } from '#/modules/project/project-mocks';
import { projectSchema } from '#/modules/project/project-schema';
import { errorResponseRefs, slugQuerySchema, validIdSchema } from '#/schemas';

const publicProjectRoutes = {
  getPublicProject: createXRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    tags: ['projects', 'app', 'context'],
    operationId: 'getPublicProject',
    summary: 'Fetch public project by ID',
    description: 'Retrieves a public project by ID. Pass ?slug=true to resolve by slug instead.',
    request: { params: z.object({ id: validIdSchema }), query: slugQuerySchema },
    responses: {
      200: {
        description: 'Project without membership public',
        content: {
          'application/json': {
            schema: projectSchema.extend({ membership: z.null() }),
            example: { ...mockProjectResponse(), membership: null },
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
};

export { publicProjectRoutes };
