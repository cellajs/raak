import { createXRoutes, json, jsonBody, xRoute } from '#/core/x-routes';
import { actorGuard, orgGuard, tenantGuard, userGuard } from '#/middlewares/guard';
import { insertEntityLock } from '#/middlewares/insert-entity-lock';
import { bulkPointsLimiter, singlePointsLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockBatchWorkspacesResponse, mockPaginatedWorkspacesResponse, mockWorkspaceResponse } from '#/modules/workspace/workspace-mocks';
import {
  workspaceCreateBodySchema,
  workspaceCreateResponseSchema,
  workspaceListQuerySchema,
  workspaceSchema,
  workspaceUpdateBodySchema,
} from '#/modules/workspace/workspace-schema';
import {
  batchResponseSchema,
  idInTenantOrgParamSchema,
  idsBodySchema,
  paginationSchema,
  slugIncludeQuerySchema,
  tenantOrgParamSchema,
} from '#/schemas';

const workspaceRoutes = createXRoutes(['workspaces', 'app', 'channel'], {
  createWorkspaces: xRoute({
    method: 'post',
    path: '/{tenantId}/{organizationId}/workspaces',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [insertEntityLock, bulkPointsLimiter],
    summary: 'Create workspaces',
    description: 'Creates one or more personal workspaces owned by the current user.',
    request: { params: tenantOrgParamSchema, body: jsonBody(workspaceCreateBodySchema) },
    responses: { 201: json('Workspaces created', workspaceCreateResponseSchema, mockBatchWorkspacesResponse()) },
  }),
  getWorkspaces: xRoute({
    method: 'get',
    path: '/workspaces',
    xGuard: [userGuard],
    summary: 'Get list of workspaces',
    description:
      'Returns a paginated list of workspaces where the current user has a membership. ' +
      'Results are sorted by membership displayOrder (the user’s personal arrangement) in ascending order by default. ' +
      'Optional filters: organizationId to scope to a specific organization, ' +
      'role to filter by membership role, excludeArchived to hide archived memberships, ' +
      'and q to search by workspace name.',
    request: { query: workspaceListQuerySchema },
    responses: { 200: json('Workspaces', paginationSchema(workspaceSchema), mockPaginatedWorkspacesResponse()) },
  }),
  getWorkspace: xRoute({
    method: 'get',
    path: '/{tenantId}/{organizationId}/workspaces/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    summary: 'Get workspace',
    description: 'Retrieves a workspace by ID. Pass ?slug=true to resolve by slug instead.',
    request: { params: idInTenantOrgParamSchema, query: slugIncludeQuerySchema },
    responses: { 200: json('Workspace', workspaceSchema, mockWorkspaceResponse()) },
  }),
  updateWorkspace: xRoute({
    method: 'put',
    path: '/{tenantId}/{organizationId}/workspaces/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    summary: 'Update workspace',
    description: 'Updates a workspace by ID.',
    request: { params: idInTenantOrgParamSchema, body: jsonBody(workspaceUpdateBodySchema) },
    responses: { 200: json('Workspace updated', workspaceSchema, mockWorkspaceResponse()) },
  }),
  deleteWorkspaces: xRoute({
    method: 'delete',
    path: '/{tenantId}/{organizationId}/workspaces',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Delete workspaces',
    description: 'Deletes one or more workspaces by ID.',
    request: { params: tenantOrgParamSchema, body: jsonBody(idsBodySchema()) },
    responses: { 200: json('Success', batchResponseSchema()) },
  }),
});

export { workspaceRoutes };
