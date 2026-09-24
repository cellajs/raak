import { createXRoute } from '#/core/x-routes';
import { orgGuard, tenantGuard, userGuard } from '#/middlewares/guard';
import { productCache } from '#/middlewares/product-cache';
import { bulkPointsLimiter, singlePointsLimiter, syncReadLimiter } from '#/middlewares/rate-limiter/limiters';
import { createTasksOp } from '#/modules/task/operations/create-tasks';
import { getTaskOp } from '#/modules/task/operations/get-task';
import { getTasksOp } from '#/modules/task/operations/get-tasks';
import { updateTaskOp } from '#/modules/task/operations/update-task';
import { mockBatchTasksResponse, mockTaskResponse, mockTasksResponse } from '#/modules/task/task-mocks';
import {
  taskCreateManyStxBodySchema,
  taskCreateResponseSchema,
  taskListQuerySchema,
  taskSchema,
  taskUpdateStxBodySchema,
} from '#/modules/task/task-schema';
import {
  batchResponseSchema,
  errorResponseRefs,
  fullResponseQuerySchema,
  idInTenantOrgParamSchema,
  idsWithStxBodySchema,
  paginationSchema,
  tenantOrgParamSchema,
} from '#/schemas';

const taskRoutes = {
  /**
   * Create one or more tasks within a project
   */
  createTasks: createXRoute({
    operationId: 'createTasks',
    method: 'post',
    path: '/',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    tags: ['tasks', 'app', 'product'],
    summary: 'Create tasks',
    description: 'Creates one or more tasks within a project.',
    'x-tool': {
      enabled: true,
      description: 'Create one or more tasks in a project. Requires project ID, task name, and status.',
      approvalRequired: true,
      category: 'tasks',
      entity: 'task',
      execute: (ctx, { body }) => createTasksOp(ctx, body),
    },
    request: {
      params: tenantOrgParamSchema,
      body: { required: true, content: { 'application/json': { schema: taskCreateManyStxBodySchema } } },
    },
    responses: {
      200: {
        description: 'Tasks already created (idempotent)',
        content: { 'application/json': { schema: taskCreateResponseSchema, example: mockBatchTasksResponse() } },
      },
      201: {
        description: 'Tasks created',
        content: { 'application/json': { schema: taskCreateResponseSchema, example: mockBatchTasksResponse() } },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Get list of tasks within one or more projects
   */
  getTasks: createXRoute({
    operationId: 'getTasks',
    method: 'get',
    path: '/',
    xGuard: [userGuard, tenantGuard, orgGuard],
    // Sync-driven read backpressure on the delta path (template pattern for app product lists)
    xRateLimiter: [syncReadLimiter],
    tags: ['tasks', 'app', 'product'],
    summary: 'Get list of tasks',
    description: 'Returns a list of tasks within one or more specified projects.',
    'x-tool': {
      enabled: true,
      description:
        'Search tasks by keyword, status, label, or project. Returns matching task summaries with status and assignees.',
      approvalRequired: false,
      category: 'tasks',
      entity: 'task',
      execute: (ctx, { query }) => getTasksOp(ctx, query),
    },
    request: {
      params: tenantOrgParamSchema,
      query: taskListQuerySchema,
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
  getTask: createXRoute({
    operationId: 'getTask',
    method: 'get',
    path: '/{id}',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xCache: [productCache('task')],
    tags: ['tasks', 'app', 'product'],
    summary: 'Get task',
    description: 'Retrieves a task by its ID.',
    'x-tool': {
      enabled: true,
      description: 'Get full task details including description, labels, and assignees.',
      approvalRequired: false,
      category: 'tasks',
      entity: 'task',
      execute: (ctx, { params }) => getTaskOp(ctx, params.id),
    },
    request: { params: idInTenantOrgParamSchema },
    responses: {
      200: {
        description: 'Tasks',
        content: { 'application/json': { schema: taskSchema, example: mockTaskResponse() } },
      },
      ...errorResponseRefs,
    },
  }),
  updateTask: createXRoute({
    operationId: 'updateTask',
    method: 'put',
    path: '/{id}',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    tags: ['tasks', 'app', 'product'],
    summary: 'Update task',
    description: 'Updates a task by ID.',
    'x-tool': {
      enabled: true,
      description: 'Update task fields: summary, status, labels, assignees, description, or move to another project.',
      approvalRequired: true,
      category: 'tasks',
      entity: 'task',
      // The transaction is server-built, so field timestamps come from the server clock.
      execute: (ctx, { params, query, body }) =>
        updateTaskOp(ctx, params.id, body, { fullResponse: query.fullResponse, serverOrigin: true }),
    },
    request: {
      params: idInTenantOrgParamSchema,
      query: fullResponseQuerySchema,
      body: {
        content: { 'application/json': { schema: taskUpdateStxBodySchema } },
      },
    },
    responses: {
      200: {
        description: 'Task updated',
        content: { 'application/json': { schema: taskSchema, example: mockTaskResponse() } },
      },
      ...errorResponseRefs,
    },
  }),
  deleteTasks: createXRoute({
    operationId: 'deleteTasks',
    method: 'delete',
    path: '/',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    tags: ['tasks', 'app', 'product'],
    summary: 'Delete tasks',
    description: 'Deletes one or more tasks by ID.',
    request: {
      params: tenantOrgParamSchema,
      body: { content: { 'application/json': { schema: idsWithStxBodySchema(100) } } },
    },
    responses: {
      200: {
        description: 'Success',
        content: { 'application/json': { schema: batchResponseSchema() } },
      },
      ...errorResponseRefs,
    },
  }),
};

export { taskRoutes };
