import { z } from '@hono/zod-openapi';
import { createXRoutes, json, xRoute } from '#/core/x-routes';
import { publicGuard } from '#/middlewares/guard';
import { mockTaskResponse, mockTasksResponse } from '#/modules/task/task-mocks';
import { taskListQueryBaseSchema, taskSchema } from '#/modules/task/task-schema';
import { maxLength, paginationSchema, validIdSchema } from '#/schemas';

const publicTaskRoutes = createXRoutes(['tasks', 'app', 'product'], {
  getPublicTask: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [publicGuard],
    summary: 'Get public task',
    description: 'Retrieves a task by its ID. For publicly shared.',
    request: { params: z.object({ id: validIdSchema }) },
    responses: { 200: json('Task', taskSchema, mockTaskResponse()) },
  }),
  getPublicTasks: xRoute({
    method: 'get',
    path: '/',
    xGuard: [publicGuard],
    summary: 'Get public tasks',
    description: 'Returns a list of public tasks associated with a specific project. For publicly shared boards.',
    request: { query: taskListQueryBaseSchema.omit({ workspaceId: true }).extend({ projectId: z.string().max(maxLength.id) }) },
    responses: { 200: json('Tasks', paginationSchema(taskSchema), mockTasksResponse()) },
  }),
});

export { publicTaskRoutes };
