import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { claimSandboxOp } from '#/modules/sandbox/operations/claim-sandbox';
import { getSandboxOp } from '#/modules/sandbox/operations/get-sandbox';
import { sandboxRoutes } from '#/modules/sandbox/sandbox-routes';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(sandboxRoutes.claimSandbox, async (ctx) => {
  const sandbox = await claimSandboxOp(ctx);
  return sandbox.claimed ? ctx.json(sandbox, 201) : ctx.json(sandbox, 200);
});

app.openapi(sandboxRoutes.getSandbox, async (ctx) => {
  const data = await getSandboxOp(ctx);
  return ctx.json(data, 200);
});

export const sandboxHandlers = app;
