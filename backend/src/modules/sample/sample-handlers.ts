import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { provisionSampleOp } from '#/modules/sample/operations/provision-sample';
import { removeSampleOp } from '#/modules/sample/operations/remove-sample';
import { sampleRoutes } from '#/modules/sample/sample-routes';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(sampleRoutes.provisionSample, async (ctx) => {
  const data = await provisionSampleOp(ctx, ctx.req.valid('query'));
  return ctx.json(data, 200);
});

app.openapi(sampleRoutes.removeSample, async (ctx) => {
  const data = await removeSampleOp(ctx);
  return ctx.json(data, 200);
});

export const sampleHandlers = app;
