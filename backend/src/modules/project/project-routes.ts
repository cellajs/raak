import { createXRoutes, json, jsonBody, xRoute } from '#/core/x-routes';
import { actorGuard, orgGuard, relatableGuard, tenantGuard, userGuard } from '#/middlewares/guard';
import { insertEntityLock } from '#/middlewares/insert-entity-lock';
import { bulkPointsLimiter, singlePointsLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockBatchProjectsResponse, mockPaginatedProjectsResponse, mockProjectResponse } from '#/modules/project/project-mocks';
import {
  projectCreateBodySchema,
  projectCreateResponseSchema,
  projectListQuerySchema,
  projectSchema,
  projectUpdateBodySchema,
  projectWithMembershipSchema,
  workspaceIdQuerySchema,
} from '#/modules/project/project-schema';
import {
  batchResponseSchema,
  idInTenantOrgParamSchema,
  idsBodySchema,
  paginationSchema,
  slugIncludeQuerySchema,
  tenantOrgParamSchema,
} from '#/schemas';

const projectRoutes = createXRoutes(['projects', 'app', 'channel'], {
  createProjects: xRoute({
    method: 'post',
    path: '/{tenantId}/{organizationId}/projects',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [insertEntityLock, bulkPointsLimiter],
    summary: 'Create projects',
    description: 'Creates one or more projects within an organization. The current user is assigned as an admin and can invite additional members.',
    request: { params: tenantOrgParamSchema, query: workspaceIdQuerySchema, body: jsonBody(projectCreateBodySchema) },
    responses: { 201: json('Projects created', projectCreateResponseSchema, mockBatchProjectsResponse()) },
  }),
  getProjects: xRoute({
    method: 'get',
    path: '/projects',
    xGuard: [userGuard, relatableGuard],
    summary: 'Get list of projects',
    description:
      'Returns a paginated list of projects where the current user has a membership. ' +
      'Results are sorted by membership displayOrder (the user’s personal arrangement) in ascending order by default. ' +
      'Optional filters: organizationId to scope to a specific organization, ' +
      'workspaceId to scope to a specific workspace, ' +
      'role to filter by membership role, excludeArchived to hide archived memberships, ' +
      'and q to search by project name. ' +
      'With relatableUserId it lists that user’s projects in the organizations the caller shares with them, by name; ' +
      'role, excludeArchived and workspaceId describe that user’s own membership and are refused there.',
    request: { query: projectListQuerySchema },
    responses: { 200: json('Projects', paginationSchema(projectSchema), mockPaginatedProjectsResponse()) },
  }),
  getProject: xRoute({
    method: 'get',
    path: '/{tenantId}/{organizationId}/projects/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    summary: 'Get project',
    description: 'Retrieves a project by ID. Pass ?slug=true to resolve by slug instead.',
    request: { params: idInTenantOrgParamSchema, query: slugIncludeQuerySchema },
    responses: { 200: json('Project', projectSchema, mockProjectResponse()) },
  }),
  updateProject: xRoute({
    method: 'put',
    path: '/{tenantId}/{organizationId}/projects/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    summary: 'Update project',
    description: 'Updates a project by ID.',
    request: { params: idInTenantOrgParamSchema, body: jsonBody(projectUpdateBodySchema) },
    responses: { 200: json('Project updated', projectSchema, mockProjectResponse()) },
  }),
  assignProjectWorkspace: xRoute({
    method: 'put',
    path: '/{tenantId}/{organizationId}/projects/{id}/assign-workspace',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    summary: 'Assign project to workspace',
    description: "Assigns a project to a workspace using the provided workspaceId. This does not affect the project's ownership or organization.",
    request: { params: idInTenantOrgParamSchema, query: workspaceIdQuerySchema },
    responses: { 200: json('Project assigned to the new workspace', projectWithMembershipSchema, mockProjectResponse()) },
  }),
  removeProjectWorkspace: xRoute({
    method: 'delete',
    path: '/{tenantId}/{organizationId}/projects/{id}/workspace',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    summary: 'Remove project from workspace',
    description: "Removes the current user's project membership from its assigned workspace without leaving the project.",
    request: { params: idInTenantOrgParamSchema },
    responses: { 200: json('Project removed from workspace', projectWithMembershipSchema, mockProjectResponse()) },
  }),
  moveProjectToWorkspace: xRoute({
    method: 'put',
    path: '/{tenantId}/{organizationId}/projects/{id}/move',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    summary: 'Move project between workspaces',
    description: 'Moves a project from one workspace to another.',
    request: { params: idInTenantOrgParamSchema, query: workspaceIdQuerySchema },
    responses: { 200: json('Moved project', projectWithMembershipSchema, mockProjectResponse()) },
  }),
  deleteProjects: xRoute({
    method: 'delete',
    path: '/{tenantId}/{organizationId}/projects',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Delete projects',
    description: 'Deletes one or more projects by ID.',
    request: { params: tenantOrgParamSchema, body: jsonBody(idsBodySchema()) },
    responses: { 200: json('Success', batchResponseSchema()) },
  }),
});

export { projectRoutes };
