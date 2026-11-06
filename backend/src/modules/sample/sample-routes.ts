import { createXRoutes, json, xRoute } from '#/core/x-routes';
import { orgGuard, tenantGuard, userGuard } from '#/middlewares/guard';
import { insertEntityLock } from '#/middlewares/insert-entity-lock';
import { bulkPointsLimiter } from '#/middlewares/rate-limiter/limiters';
import { sampleProvisionQuerySchema, sampleProvisionResponseSchema } from '#/modules/sample/sample-schema';
import { batchResponseSchema, tenantOrgParamSchema } from '#/schemas';

const sampleRoutes = createXRoutes(['samples', 'app', 'channel'], {
  provisionSample: xRoute({
    method: 'post',
    path: '/{tenantId}/{organizationId}/sample',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [insertEntityLock, bulkPointsLimiter],
    summary: 'Add the sample',
    description:
      "Adds the current user to the organization's sample: projects with tasks by a sample team. " +
      'The first to add it creates it and becomes its admin; every later member joins the same projects.',
    request: { params: tenantOrgParamSchema, query: sampleProvisionQuerySchema },
    responses: { 200: json('Sample in place', sampleProvisionResponseSchema) },
  }),
  removeSample: xRoute({
    method: 'delete',
    path: '/{tenantId}/{organizationId}/sample',
    xGuard: [userGuard, tenantGuard, orgGuard],
    xRateLimiter: [bulkPointsLimiter],
    summary: 'Remove the sample',
    description: 'Deletes the sample projects with their tasks; the sample team leaves the organization once none is left.',
    request: { params: tenantOrgParamSchema },
    responses: { 200: json('Success', batchResponseSchema()) },
  }),
});

export { sampleRoutes };
