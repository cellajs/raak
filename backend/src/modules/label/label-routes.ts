import { createXRoute } from '#/core/x-routes';
import { appCache } from '#/middlewares/entity-cache';
import { authGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
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
  createLabels: createXRoute({
    method: 'post',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['labels', 'app', 'product'],
    operationId: 'createLabels',
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
  getLabels: createXRoute({
    method: 'get',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['labels', 'app', 'product'],
    operationId: 'getLabels',
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
  getLabel: createXRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    xCache: [appCache()],
    tags: ['labels', 'app', 'product'],
    operationId: 'getLabel',
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
  updateLabel: createXRoute({
    method: 'put',
    path: '/{id}',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['labels', 'app', 'product'],
    operationId: 'updateLabel',
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
  deleteLabels: createXRoute({
    method: 'delete',
    path: '/',
    xGuard: [authGuard, tenantGuard, orgGuard],
    tags: ['labels', 'app', 'product'],
    operationId: 'deleteLabels',
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
