import {
  errorResponses,
  successWithDataSchema,
  successWithErrorsSchema,
  successWithPaginationSchema,
  successWithoutDataSchema,
} from '#/utils/schema/common-responses';
import { idOrSlugSchema, idSchema, idsQuerySchema, productParamSchema } from '#/utils/schema/common-schemas';

import { createRouteConfig } from '#/lib/route-config';
import { hasOrgAccess, isAuthenticated, isPublicAccess } from '#/middlewares/guard';

import { z } from 'zod';
import { createTaskSchema, getTasksQuerySchema, importTasksBodySchema, taskWithSubtasksSchema, updateTaskSchema, updatedTaskSchema } from './schema';

class TaskRoutesConfig {
  public createTask = createRouteConfig({
    method: 'post',
    path: '/',
    guard: [isAuthenticated, hasOrgAccess],
    tags: ['tasks'],
    summary: 'Create new task',
    description: 'Create a new task in a project.',
    request: {
      params: z.object({ orgIdOrSlug: idOrSlugSchema }),
      body: {
        required: true,
        content: {
          'application/json': {
            schema: createTaskSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Task',
        content: {
          'application/json': {
            schema: successWithDataSchema(taskWithSubtasksSchema),
          },
        },
      },
      ...errorResponses,
    },
  });

  public getTasks = createRouteConfig({
    method: 'get',
    path: '/',
    guard: [isAuthenticated, hasOrgAccess],
    tags: ['tasks'],
    summary: 'Get list of tasks',
    description: 'Get list of tasks for specific projects.',
    request: {
      params: z.object({ orgIdOrSlug: idOrSlugSchema }),
      query: getTasksQuerySchema,
    },
    responses: {
      200: {
        description: 'Tasks',
        content: {
          'application/json': {
            schema: successWithPaginationSchema(taskWithSubtasksSchema),
          },
        },
      },
      ...errorResponses,
    },
  });

  public updateTask = createRouteConfig({
    method: 'put',
    path: '/{id}',
    guard: [isAuthenticated, hasOrgAccess],
    tags: ['tasks'],
    summary: 'Update task',
    description: 'Update task by id.',
    request: {
      params: productParamSchema,
      body: {
        content: {
          'application/json': {
            schema: updateTaskSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Task updated',
        content: {
          'application/json': {
            schema: successWithDataSchema(updatedTaskSchema),
          },
        },
      },
      ...errorResponses,
    },
  });

  public deleteTasks = createRouteConfig({
    method: 'delete',
    path: '/',
    guard: [isAuthenticated, hasOrgAccess],
    tags: ['tasks'],
    summary: 'Delete tasks',
    description: 'Delete tasks by ids.',
    request: {
      params: z.object({ orgIdOrSlug: idOrSlugSchema }),
      query: idsQuerySchema,
    },
    responses: {
      200: {
        description: 'Success',
        content: {
          'application/json': {
            schema: successWithErrorsSchema(),
          },
        },
      },
      ...errorResponses,
    },
  });

  public importTasks = createRouteConfig({
    method: 'post',
    path: '/import/:projectId',
    // TODO: Stricter rate limiting
    guard: [isAuthenticated, hasOrgAccess],
    tags: ['tasks'],
    summary: 'Import tasks',
    description: 'Import tasks from a Zip file for a specific project. Currently only supports Pivotal format.',
    request: {
      params: z.object({ projectId: idSchema, orgIdOrSlug: idOrSlugSchema }),
      body: {
        content: {
          'multipart/form-data': {
            schema: importTasksBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Tasks imported',
        content: {
          'application/json': {
            schema: successWithoutDataSchema,
          },
        },
      },
      ...errorResponses,
    },
  });

  public redirectToTask = createRouteConfig({
    method: 'get',
    path: '/{id}/link',
    tags: ['tasks'],
    guard: [isPublicAccess],
    summary: 'Redirect to task',
    description: 'Redirect to task by id.',
    request: {
      params: z.object({
        id: idSchema,
      }),
    },
    responses: {
      200: {
        description: 'Success',
      },
      ...errorResponses,
    },
  });

  public getTaskCover = createRouteConfig({
    method: 'get',
    path: '/{id}/cover',
    guard: [isPublicAccess],
    tags: ['tasks'],
    summary: 'Get task cover',
    description: 'Get task cover image by id.',
    request: {
      params: z.object({
        id: idSchema,
      }),
    },
    responses: {
      200: {
        description: 'Success',
      },
      ...errorResponses,
    },
  });
}
export default new TaskRoutesConfig();
