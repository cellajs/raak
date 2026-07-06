import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { createWorkspacesOp } from '#/modules/workspace/operations/create-workspaces';
import { deleteWorkspacesOp } from '#/modules/workspace/operations/delete-workspaces';
import { getWorkspaceOp } from '#/modules/workspace/operations/get-workspace';
import { getWorkspacesOp } from '#/modules/workspace/operations/get-workspaces';
import { updateWorkspaceOp } from '#/modules/workspace/operations/update-workspace';
import { workspaceRoutes } from '#/modules/workspace/workspace-routes';
import '#/modules/workspace/workspace-module';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(workspaceRoutes.createWorkspaces, async (ctx) => {
  const data = await createWorkspacesOp(ctx, ctx.req.valid('json'));
  return ctx.json(data, 201);
});

app.openapi(workspaceRoutes.getWorkspaces, async (ctx) => {
  const data = await getWorkspacesOp(ctx, ctx.req.valid('query'));
  return ctx.json(data, 200);
});

app.openapi(workspaceRoutes.getWorkspace, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { slug: bySlug, include } = ctx.req.valid('query');
  const data = await getWorkspaceOp(ctx, id, { bySlug, include });
  return ctx.json(data, 200);
});

app.openapi(workspaceRoutes.updateWorkspace, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const data = await updateWorkspaceOp(ctx, id, ctx.req.valid('json'));
  return ctx.json(data, 200);
});

app.openapi(workspaceRoutes.deleteWorkspaces, async (ctx) => {
  const { ids } = ctx.req.valid('json');
  const data = await deleteWorkspacesOp(ctx, Array.isArray(ids) ? ids : [ids]);
  return ctx.json(data, 200);
});

export const workspaceHandlers = app;
