import { createXRoute } from '#/core/x-routes';
import { authGuard, crossTenantGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
import { insertEntityLock } from '#/middlewares/insert-entity-lock';
import { bulkPointsLimiter, singlePointsLimiter } from '#/middlewares/rate-limiter/limiters';
import {
  mockBatchWorkspacesResponse,
  mockPaginatedWorkspacesResponse,
  mockWorkspaceResponse,
} from '#/modules/workspace/workspace-mocks';
import {
  workspaceCreateBodySchema,
  workspaceCreateResponseSchema,
  workspaceListQuerySchema,
  workspaceSchema,
  workspaceUpdateBodySchema,
} from '#/modules/workspace/workspace-schema';
import {
  batchResponseSchema,
  errorResponseRefs,
  idInTenantOrgParamSchema,
  idsBodySchema,
  paginationSchema,
  slugIncludeQuerySchema,
  tenantOrgParamSchema,
} from '#/schemas';

const workspaceRoutes = {
  /**
   * Create one or more personal workspaces
   */
  createWorkspaces: createXRoute({
    method: 'post',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [insertEntityLock, bulkPointsLimiter],
    tags: ['workspaces', 'app', 'context'],
    operationId: 'createWorkspaces',
    summary: 'Create workspaces',
    description: 'Creates one or more personal workspaces owned by the current user.',
    request: {
      params: tenantOrgParamSchema,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: workspaceCreateBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Workspaces created',
        content: {
          'application/json': {
            schema: workspaceCreateResponseSchema,
            example: mockBatchWorkspacesResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Get list of workspaces where the current user has a membership (cross-tenant)
   */
  getWorkspaces: createXRoute({
    method: 'get',
    path: '/',
    xGuard: [authGuard, crossTenantGuard],
    tags: ['workspaces', 'app', 'context'],
    operationId: 'getWorkspaces',
    summary: 'Get list of workspaces',
    description:
      'Returns a paginated list of workspaces where the current user has a membership. ' +
      'Results are sorted by membership displayOrder (the user’s personal arrangement) in ascending order by default. ' +
      'Optional filters: organizationId to scope to a specific organization, ' +
      'role to filter by membership role, excludeArchived to hide archived memberships, ' +
      'and q to search by workspace name.',
    request: { query: workspaceListQuerySchema },
    responses: {
      200: {
        description: 'Workspaces',
        content: {
          'application/json': {
            schema: paginationSchema(workspaceSchema),
            example: mockPaginatedWorkspacesResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Get a workspace (tenant + org scoped)
   */
  getWorkspace: createXRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['workspaces', 'app', 'context'],
    operationId: 'getWorkspace',
    summary: 'Get workspace',
    description: 'Retrieves a workspace by ID. Pass ?slug=true to resolve by slug instead.',
    request: {
      params: idInTenantOrgParamSchema,
      query: slugIncludeQuerySchema,
    },
    responses: {
      200: {
        description: 'Workspace',
        content: { 'application/json': { schema: workspaceSchema, example: mockWorkspaceResponse() } },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Update a workspace
   */
  updateWorkspace: createXRoute({
    method: 'put',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    tags: ['workspaces', 'app', 'context'],
    operationId: 'updateWorkspace',
    summary: 'Update workspace',
    description: 'Updates a workspace by ID.',
    request: {
      params: idInTenantOrgParamSchema,
      body: {
        content: {
          'application/json': {
            schema: workspaceUpdateBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Workspace updated',
        content: {
          'application/json': {
            schema: workspaceSchema,
            example: mockWorkspaceResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Delete one or more workspaces
   */
  deleteWorkspaces: createXRoute({
    method: 'delete',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    tags: ['workspaces', 'app', 'context'],
    operationId: 'deleteWorkspaces',
    summary: 'Delete workspaces',
    description: 'Deletes one or more workspaces by ID.',
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

export { workspaceRoutes };
