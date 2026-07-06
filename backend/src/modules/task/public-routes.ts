import { z } from '@hono/zod-openapi';
import { createXRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { mockTaskResponse, mockTasksResponse } from '#/modules/task/task-mocks';
import { taskListQueryBaseSchema, taskSchema } from '#/modules/task/task-schema';
import { errorResponseRefs, maxLength, paginationSchema, validIdSchema } from '#/schemas';

const publicTaskRoutes = {
  getPublicTask: createXRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    tags: ['tasks', 'app', 'product'],
    operationId: 'getPublicTask',
    summary: 'Get public task',
    description: 'Retrieves a task by its ID. For publicly shared.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: {
      200: {
        description: 'Task',
        content: { 'application/json': { schema: taskSchema, example: mockTaskResponse() } },
      },
      ...errorResponseRefs,
    },
  }),

  getPublicTasks: createXRoute({
    method: 'get',
    path: '/',
    xGuard: [publicGuard],
    tags: ['tasks', 'app', 'product'],
    operationId: 'getPublicTasks',
    summary: 'Get public tasks',
    description: 'Returns a list of public tasks associated with a specific project. For publicly shared boards.',
    request: {
      query: taskListQueryBaseSchema.omit({ workspaceId: true }).extend({ projectId: z.string().max(maxLength.id) }),
    },
    responses: {
      200: {
        description: 'Tasks',
        content: {
          'application/json': {
            schema: paginationSchema(taskSchema),
            example: mockTasksResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
};

export { publicTaskRoutes };
