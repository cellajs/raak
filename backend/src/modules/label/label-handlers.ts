import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { assertSuccess } from '#/core/operation-result';
import labelRoutes from '#/modules/label/label-routes';
import '#/modules/label/label-module';
import { createLabelsOp } from '#/modules/label/operations/create-labels';
import { deleteLabelsOp } from '#/modules/label/operations/delete-labels';
import { getLabelOp } from '#/modules/label/operations/get-label';
import { getLabelsOp } from '#/modules/label/operations/get-labels';
import { updateLabelOp } from '#/modules/label/operations/update-label';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(labelRoutes.createLabels, async (ctx) => {
  const result = await createLabelsOp(ctx, ctx.req.valid('json'));
  assertSuccess(result, 'label');
  return ctx.json(result.data, 201);
});

app.openapi(labelRoutes.getLabels, async (ctx) => {
  const result = await getLabelsOp(ctx, ctx.req.valid('query'));
  assertSuccess(result, 'label');
  return ctx.json(result.data, 200);
});

app.openapi(labelRoutes.getLabel, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const result = await getLabelOp(ctx, id);
  assertSuccess(result, 'label');
  ctx.set('entityCacheData', result.data);
  return ctx.json(result.data, 200);
});

app.openapi(labelRoutes.updateLabel, async (ctx) => {
  const id = ctx.req.param('id');
  const result = await updateLabelOp(ctx, id, ctx.req.valid('json'));
  assertSuccess(result, 'label');
  return ctx.json(result.data, 200);
});

app.openapi(labelRoutes.deleteLabels, async (ctx) => {
  const { ids } = ctx.req.valid('json');
  const result = await deleteLabelsOp(ctx, Array.isArray(ids) ? ids : [ids]);
  assertSuccess(result, 'label');
  return ctx.json(result.data, 200);
});

export const labelHandlers = app;
