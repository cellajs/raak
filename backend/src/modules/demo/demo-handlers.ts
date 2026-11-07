import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { demoRoutes } from '#/modules/demo/demo-routes';
import { claimDemoOp } from '#/modules/demo/operations/claim-demo';
import { getDemoOp } from '#/modules/demo/operations/get-demo';
import { getDemoInviteOp, joinDemoOp } from '#/modules/demo/operations/join-demo';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(demoRoutes.claimDemo, async (ctx) => {
  const demo = await claimDemoOp(ctx);
  return demo.claimed ? ctx.json(demo, 201) : ctx.json(demo, 200);
});

app.openapi(demoRoutes.getDemo, async (ctx) => {
  const data = await getDemoOp(ctx);
  return ctx.json(data, 200);
});

app.openapi(demoRoutes.getDemoInvite, async (ctx) => {
  const invite = await getDemoInviteOp(ctx, ctx.req.valid('param'));
  return ctx.json(invite, 200);
});

app.openapi(demoRoutes.joinDemo, async (ctx) => {
  const demo = await joinDemoOp(ctx, { ...ctx.req.valid('param'), ...ctx.req.valid('json') });
  return demo.claimed ? ctx.json(demo, 201) : ctx.json(demo, 200);
});

export const demoHandlers = app;
