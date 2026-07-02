import { createXRoute } from '#/core/x-routes';
import { appCache } from '#/middlewares/entity-cache';
import { authGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
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
  createTasks: createXRoute({
    method: 'post',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['tasks', 'app', 'product'],
    operationId: 'createTasks',
    summary: 'Create tasks',
    description: 'Creates one or more tasks within a project.',
    'x-tool': {
      enabled: true,
      description: 'Create one or more tasks in a project. Requires project ID, task name, and status.',
      approvalRequired: true,
      category: 'tasks',
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
  getTasks: createXRoute({
    method: 'get',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['tasks', 'app', 'product'],
    operationId: 'getTasks',
    summary: 'Get list of tasks',
    description: 'Returns a list of tasks within one or more specified projects.',
    'x-tool': {
      enabled: true,
      description:
        'Search tasks by keyword, status, label, or project. Returns matching task summaries with status and assignees.',
      approvalRequired: false,
      category: 'tasks',
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
    method: 'get',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xCache: [appCache()],
    tags: ['tasks', 'app', 'product'],
    operationId: 'getTask',
    summary: 'Get task',
    description: 'Retrieves a task by its ID.',
    'x-tool': {
      enabled: true,
      description: 'Get full task details including description, labels, and assignees.',
      approvalRequired: false,
      category: 'tasks',
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
    method: 'put',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['tasks', 'app', 'product'],
    operationId: 'updateTask',
    summary: 'Update task',
    description: 'Updates a task by ID.',
    'x-tool': {
      enabled: true,
      description: 'Update task fields: summary, status, labels, assignees, description, or move to another project.',
      approvalRequired: true,
      category: 'tasks',
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
    method: 'delete',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['tasks', 'app', 'product'],
    operationId: 'deleteTasks',
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

export default taskRoutes;
