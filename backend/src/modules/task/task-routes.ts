import { createXRoutes, json, jsonBody, xRoute } from '#/core/x-routes';
import { actorGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
import { productCache } from '#/middlewares/product-cache';
import { bulkPointsLimiter, singlePointsLimiter, syncReadLimiter } from '#/middlewares/rate-limiter/limiters';
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
  fullResponseQuerySchema,
  idInTenantOrgParamSchema,
  idsWithStxBodySchema,
  paginationSchema,
  tenantOrgParamSchema,
} from '#/schemas';

const taskRoutes = createXRoutes(['tasks', 'app', 'product'], {
  createTasks: xRoute({
    method: 'post',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    xTool: {
      description: 'Create one or more tasks in a project. Requires project ID, task name, and status.',
      approvalRequired: true,
      entity: 'task',
    },
    summary: 'Create tasks',
    description: 'Creates one or more tasks within a project.',
    request: { params: tenantOrgParamSchema, body: jsonBody(taskCreateManyStxBodySchema) },
    responses: {
      200: json('Tasks already created (idempotent)', taskCreateResponseSchema, mockBatchTasksResponse()),
      201: json('Tasks created', taskCreateResponseSchema, mockBatchTasksResponse()),
    },
  }),
  getTasks: xRoute({
    method: 'get',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    // Sync-driven read backpressure on the delta path (template pattern for app product lists)
    xRateLimiter: [syncReadLimiter],
    xTool: {
      description: 'Search tasks by keyword, status, label, or project. Returns matching task summaries with status and assignees.',
      approvalRequired: false,
      entity: 'task',
    },
    summary: 'Get list of tasks',
    description: 'Returns a list of tasks within one or more specified projects.',
    request: { params: tenantOrgParamSchema, query: taskListQuerySchema },
    responses: { 200: json('Tasks', paginationSchema(taskSchema), mockTasksResponse()) },
  }),
  getTask: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xCache: [productCache('task')],
    xTool: { description: 'Get full task details including description, labels, and assignees.', approvalRequired: false, entity: 'task' },
    summary: 'Get task',
    description: 'Retrieves a task by its ID.',
    request: { params: idInTenantOrgParamSchema },
    responses: { 200: json('Tasks', taskSchema, mockTaskResponse()) },
  }),
  updateTask: xRoute({
    method: 'put',
    path: '/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    xTool: {
      description: 'Update task fields: summary, status, labels, assignees, description, or move to another project.',
      approvalRequired: true,
      entity: 'task',
    },
    summary: 'Update task',
    description: 'Updates a task by ID.',
    request: { params: idInTenantOrgParamSchema, query: fullResponseQuerySchema, body: jsonBody(taskUpdateStxBodySchema) },
    responses: { 200: json('Task updated', taskSchema, mockTaskResponse()) },
  }),
  deleteTasks: xRoute({
    method: 'delete',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Delete tasks',
    description: 'Deletes one or more tasks by ID.',
    request: { params: tenantOrgParamSchema, body: jsonBody(idsWithStxBodySchema(100)) },
    responses: { 200: json('Success', batchResponseSchema()) },
  }),
});

export { taskRoutes };
