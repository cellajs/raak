import { createXRoutes, json, jsonBody, xRoute } from '#/core/x-routes';
import { actorGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
import { productCache } from '#/middlewares/product-cache';
import { bulkPointsLimiter, singlePointsLimiter, syncReadLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockBatchLabelsResponse, mockLabelResponse, mockPaginatedLabelsResponse } from '#/modules/label/label-mocks';
import {
  labelCreateManyStxBodySchema,
  labelCreateResponseSchema,
  labelListQuerySchema,
  labelSchema,
  labelUpdateStxBodySchema,
} from '#/modules/label/label-schema';
import { batchResponseSchema, idInTenantOrgParamSchema, idsWithStxBodySchema, paginationSchema, tenantOrgParamSchema } from '#/schemas';

const labelsRoutes = createXRoutes(['labels', 'app', 'product'], {
  createLabels: xRoute({
    method: 'post',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Create labels',
    description: 'Creates one or more labels within a project.',
    request: { params: tenantOrgParamSchema, body: jsonBody(labelCreateManyStxBodySchema) },
    responses: {
      200: json('Labels already created (idempotent)', labelCreateResponseSchema, mockBatchLabelsResponse()),
      201: json('Labels created', labelCreateResponseSchema, mockBatchLabelsResponse()),
    },
  }),
  getLabels: xRoute({
    method: 'get',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    // Sync-driven read backpressure on the delta path (template pattern for app product lists)
    xRateLimiter: [syncReadLimiter],
    summary: 'Get list of labels',
    description: 'Returns a list of labels for a given project or workspace.',
    request: { params: tenantOrgParamSchema, query: labelListQuerySchema },
    responses: { 200: json('Label list', paginationSchema(labelSchema), mockPaginatedLabelsResponse()) },
  }),
  getLabel: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xCache: [productCache('label')],
    summary: 'Get label',
    description: 'Retrieves a label by its ID.',
    request: { params: idInTenantOrgParamSchema },
    responses: { 200: json('Label', labelSchema, mockLabelResponse()) },
  }),
  updateLabel: xRoute({
    method: 'put',
    path: '/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [singlePointsLimiter],
    summary: 'Update label',
    description: 'Updates a label by ID.',
    request: { params: idInTenantOrgParamSchema, body: jsonBody(labelUpdateStxBodySchema) },
    responses: { 200: json('Label updated', labelSchema, mockLabelResponse()) },
  }),
  deleteLabels: xRoute({
    method: 'delete',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Delete labels',
    description: 'Deletes one or more labels by ID.',
    request: { params: tenantOrgParamSchema, body: jsonBody(idsWithStxBodySchema()) },
    responses: { 200: json('Success', batchResponseSchema()) },
  }),
});

export { labelsRoutes };
