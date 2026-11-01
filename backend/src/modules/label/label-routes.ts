import { createXRoutes, errors, json, jsonBody, xRoute } from '#/core/x-routes';
import { actorGuard, orgGuard, tenantGuard } from '#/middlewares/guard';
import { productCache } from '#/middlewares/product-cache';
import { bulkPointsLimiter, singlePointsLimiter, syncReadLimiter } from '#/middlewares/rate-limiter/limiters';
import { mockBatchLabelsResponse, mockPaginatedLabelsResponse } from '#/modules/label/label-mocks';
import {
  labelCreateManyStxBodySchema,
  labelCreateResponseSchema,
  labelListQuerySchema,
  labelOlderAcceptedCountsQuerySchema,
  labelOlderAcceptedCountsResponseSchema,
  labelSchema,
  labelUpdateStxBodySchema,
} from '#/modules/label/label-schema';
import { batchResponseSchema, idInTenantOrgParamSchema, idsWithStxBodySchema, productListResponseSchema, tenantOrgParamSchema } from '#/schemas';

const labelRoutes = createXRoutes(['labels', 'app', 'product'], {
  createLabels: xRoute({
    method: 'post',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xScope: 'label:write',
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Create labels',
    description: 'Creates one or more labels within a project.',
    request: { params: tenantOrgParamSchema, body: jsonBody(labelCreateManyStxBodySchema) },
    responses: {
      200: json(
        'Nothing created: rows an earlier attempt created (idempotent), and rejected ids',
        labelCreateResponseSchema,
        mockBatchLabelsResponse(),
      ),
      201: json('Labels created', labelCreateResponseSchema, mockBatchLabelsResponse()),
    },
  }),
  getLabels: xRoute({
    method: 'get',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xScope: 'label:read',
    xRateLimiter: [syncReadLimiter],
    summary: 'Get list of labels',
    description: 'Returns a list of labels for a given project or workspace.',
    request: { params: tenantOrgParamSchema, query: labelListQuerySchema },
    responses: { 200: json('Label list', productListResponseSchema('label', labelSchema), mockPaginatedLabelsResponse()) },
  }),
  getLabelOlderAcceptedCounts: xRoute({
    method: 'get',
    path: '/older-accepted-counts',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xScope: 'task:read',
    xRateLimiter: [syncReadLimiter],
    summary: 'Get older accepted task counts per label',
    description: 'Returns, per label id, how many tasks of a project were accepted before the cut-off of `acceptedCutOff` days ago.',
    request: { params: tenantOrgParamSchema, query: labelOlderAcceptedCountsQuerySchema },
    responses: { 200: json('Older accepted task counts per label id', labelOlderAcceptedCountsResponseSchema) },
  }),
  getLabel: xRoute({
    method: 'get',
    path: '/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xScope: 'label:read',
    xCache: [productCache('label')],
    summary: 'Get label',
    description: 'Retrieves a label by its ID.',
    request: { params: idInTenantOrgParamSchema },
    responses: { 200: json('Label', labelSchema) },
  }),
  updateLabel: xRoute({
    method: 'put',
    path: '/{id}',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xScope: 'label:write',
    xRateLimiter: [singlePointsLimiter],
    summary: 'Update label',
    description: 'Updates a label by ID.',
    request: { params: idInTenantOrgParamSchema, body: jsonBody(labelUpdateStxBodySchema) },
    responses: { 200: json('Label updated', labelSchema), ...errors(409) },
  }),
  deleteLabels: xRoute({
    method: 'delete',
    path: '/',
    xGuard: [actorGuard, tenantGuard, orgGuard],
    xScope: 'label:write',
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Delete labels',
    description: 'Deletes one or more labels by ID.',
    request: { params: tenantOrgParamSchema, body: jsonBody(idsWithStxBodySchema()) },
    responses: { 200: json('Success', batchResponseSchema()) },
  }),
});

export { labelRoutes };
