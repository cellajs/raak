import { createXRoute } from '#/core/x-routes';
import { appCache } from '#/middlewares/entity-cache';
import { authGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
import { bulkPointsLimiter, singlePointsLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockBatchLabelsResponse, mockLabelResponse, mockPaginatedLabelsResponse } from '#/modules/label/label-mocks';
import {
  labelCreateManyStxBodySchema,
  labelCreateResponseSchema,
  labelListQuerySchema,
  labelSchema,
  labelUpdateStxBodySchema,
} from '#/modules/label/label-schema';
import {
  batchResponseSchema,
  errorResponseRefs,
  idInTenantOrgParamSchema,
  idsWithStxBodySchema,
  paginationSchema,
  tenantOrgParamSchema,
} from '#/schemas';

const labelsRoutes = {
  /**
   * Create one or more labels within a project
   */
  createLabels: createXRoute({
    operationId: 'createLabels',
    method: 'post',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    tags: ['labels', 'app', 'product'],
    summary: 'Create labels',
    description: 'Creates one or more labels within a project.',
    request: {
      params: tenantOrgParamSchema,
      body: { required: true, content: { 'application/json': { schema: labelCreateManyStxBodySchema } } },
    },
    responses: {
      200: {
        description: 'Labels already created (idempotent)',
        content: { 'application/json': { schema: labelCreateResponseSchema, example: mockBatchLabelsResponse() } },
      },
      201: {
        description: 'Labels created',
        content: { 'application/json': { schema: labelCreateResponseSchema, example: mockBatchLabelsResponse() } },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Get list of labels for a project
   */
  getLabels: createXRoute({
    operationId: 'getLabels',
    method: 'get',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['labels', 'app', 'product'],
    summary: 'Get list of labels',
    description: 'Returns a list of labels for a given project or workspace.',
    request: {
      params: tenantOrgParamSchema,
      query: labelListQuerySchema,
    },
    responses: {
      200: {
        description: 'Label list',
        content: {
          'application/json': {
            schema: paginationSchema(labelSchema),
            example: mockPaginatedLabelsResponse(),
          },
        },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Get single label by ID
   */
  getLabel: createXRoute({
    operationId: 'getLabel',
    method: 'get',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xCache: [appCache()],
    tags: ['labels', 'app', 'product'],
    summary: 'Get label',
    description: 'Retrieves a label by its ID.',
    request: {
      params: idInTenantOrgParamSchema,
    },
    responses: {
      200: {
        description: 'Label',
        content: { 'application/json': { schema: labelSchema, example: mockLabelResponse() } },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Update a label
   */
  updateLabel: createXRoute({
    operationId: 'updateLabel',
    method: 'put',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    tags: ['labels', 'app', 'product'],
    summary: 'Update label',
    description: 'Updates a label by ID.',
    request: {
      params: idInTenantOrgParamSchema,
      body: {
        content: {
          'application/json': {
            schema: labelUpdateStxBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Label updated',
        content: { 'application/json': { schema: labelSchema, example: mockLabelResponse() } },
      },
      ...errorResponseRefs,
    },
  }),
  /**
   * Delete one or more labels
   */
  deleteLabels: createXRoute({
    operationId: 'deleteLabels',
    method: 'delete',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    tags: ['labels', 'app', 'product'],
    summary: 'Delete labels',
    description: 'Deletes one or more labels by ID.',
    request: {
      params: tenantOrgParamSchema,
      body: {
        content: { 'application/json': { schema: idsWithStxBodySchema() } },
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
export default labelsRoutes;
