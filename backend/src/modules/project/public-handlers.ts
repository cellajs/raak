import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { getPublicProjectOp } from '#/modules/project/operations/get-public-project';
import { publicProjectRoutes } from '#/modules/project/public-routes';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(publicProjectRoutes.getPublicProject, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { slug: bySlug } = ctx.req.valid('query');
  const data = await getPublicProjectOp(ctx, id, bySlug);
  return ctx.json(data, 200);
});

export const publicProjectHandlers = app;
