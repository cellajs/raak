import { createXRoute } from '#/core/x-routes';
import { authGuard, crossTenantGuard, orgGuard, relatableGuard, tenantGuard } from '#/middlewares/guard';
import { insertEntityLock } from '#/middlewares/insert-entity-lock';
import { bulkPointsLimiter, singlePointsLimiter } from '#/middlewares/rate-limiter/limiters';
import {
  mockBatchProjectsResponse,
  mockPaginatedProjectsResponse,
  mockProjectResponse,
} from '#/modules/project/project-mocks';
import {
  projectCreateBodySchema,
  projectCreateResponseSchema,
  projectListQuerySchema,
  projectSchema,
  projectUpdateBodySchema,
  projectWithMembershipSchema,
  workspaceIdQuery,
} from '#/modules/project/project-schema';
import {
  batchResponseSchema,
  errorResponseRefs,
  idInTenantOrgParamSchema,
  idsBodySchema,
  paginationSchema,
  slugIncludeQuerySchema,
  tenantOrgParamSchema,
} from '#/schemas';

const projectRoutes = {
  /**
   * Create one or more projects within an organization
   */
  createProjects: createXRoute({
    method: 'post',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [insertEntityLock, bulkPointsLimiter],
    tags: ['projects', 'app', 'context'],
    operationId: 'createProjects',
    summary: 'Create projects',
    description:
      'Creates one or more projects within an organization. The current user is assigned as an admin and can invite additional members.',
    request: {
      params: tenantOrgParamSchema,
      query: workspaceIdQuery,
      body: { required: true, content: { 'application/json': { schema: projectCreateBodySchema } } },
    },
    responses: {
      201: {
        description: 'Projects created',
        content: {
          'application/json': {
            schema: projectCreateResponseSchema,
            example: mockBatchProjectsResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Get list of projects where the current user has a membership (cross-tenant)
   */
  getProjects: createXRoute({
    method: 'get',
    path: '/',
    xGuard: [authGuard, crossTenantGuard, relatableGuard],
    tags: ['projects', 'app', 'context'],
    operationId: 'getProjects',
    summary: 'Get list of projects',
    description:
      'Returns a paginated list of projects where the current user has a membership. ' +
      'Results are sorted by membership displayOrder (the user’s personal arrangement) in ascending order by default. ' +
      'Optional filters: organizationId to scope to a specific organization, ' +
      'workspaceId to scope to a specific workspace, ' +
      'role to filter by membership role, excludeArchived to hide archived memberships, ' +
      'and q to search by project name.',
    request: { query: projectListQuerySchema },
    responses: {
      200: {
        description: 'Projects',
        content: {
          'application/json': {
            schema: paginationSchema(projectSchema),
            example: mockPaginatedProjectsResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Get a project (tenant + org scoped)
   */
  getProject: createXRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['projects', 'app', 'context'],
    operationId: 'getProject',
    summary: 'Get project',
    description: 'Retrieves a project by ID. Pass ?slug=true to resolve by slug instead.',
    request: {
      params: idInTenantOrgParamSchema,
      query: slugIncludeQuerySchema,
    },
    responses: {
      200: {
        description: 'Project',
        content: { 'application/json': { schema: projectSchema, example: mockProjectResponse() } },
      },
      ...errorResponseRefs,
    },
  }),

  /**
   * Update a project
   */
  updateProject: createXRoute({
    method: 'put',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    tags: ['projects', 'app', 'context'],
    operationId: 'updateProject',
    summary: 'Update project',
    description: 'Updates a project by ID.',
    request: {
      params: idInTenantOrgParamSchema,
      body: { content: { 'application/json': { schema: projectUpdateBodySchema } } },
    },
    responses: {
      200: {
        description: 'Project updated',
        content: {
          'application/json': { schema: projectSchema, example: mockProjectResponse() },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Assign a project to a workspace
   */
  assignProjectWorkspace: createXRoute({
    method: 'put',
    path: '/{id}/assign-workspace',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    tags: ['projects', 'app', 'context'],
    operationId: 'assignProjectWorkspace',
    summary: 'Assign project to workspace',
    description:
      "Assigns a project to a workspace using the provided workspaceId. This does not affect the project's ownership or organization.",
    request: {
      params: idInTenantOrgParamSchema,
      query: workspaceIdQuery,
    },
    responses: {
      200: {
        description: 'Project assigned to the new workspace',
        content: {
          'application/json': {
            schema: projectWithMembershipSchema,
            example: mockProjectResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Remove a project from its assigned workspace
   */
  removeProjectWorkspace: createXRoute({
    method: 'delete',
    path: '/{id}/workspace',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    tags: ['projects', 'app', 'context'],
    operationId: 'removeProjectWorkspace',
    summary: 'Remove project from workspace',
    description:
      "Removes the current user's project membership from its assigned workspace without leaving the project.",
    request: {
      params: idInTenantOrgParamSchema,
    },
    responses: {
      200: {
        description: 'Project removed from workspace',
        content: {
          'application/json': {
            schema: projectWithMembershipSchema,
            example: mockProjectResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Move a project between workspaces
   */
  moveProjectToWorkspace: createXRoute({
    method: 'put',
    path: '/{id}/move',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    tags: ['projects', 'app', 'context'],
    operationId: 'moveProjectToWorkspace',
    summary: 'Move project between workspaces',
    description: 'Moves a project from one workspace to another.',
    request: { params: idInTenantOrgParamSchema, query: workspaceIdQuery },
    responses: {
      200: {
        description: 'Moved project',
        content: {
          'application/json': {
            schema: projectWithMembershipSchema,
            example: mockProjectResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Delete one or more projects
   */
  deleteProjects: createXRoute({
    method: 'delete',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    tags: ['projects', 'app', 'context'],
    operationId: 'deleteProjects',
    summary: 'Delete projects',
    description: 'Deletes one or more projects by ID.',
    request: {
      params: tenantOrgParamSchema,
      body: {
        content: { 'application/json': { schema: idsBodySchema() } },
      },
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
export default projectRoutes;
