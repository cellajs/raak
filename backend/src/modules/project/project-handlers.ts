import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import '#/modules/project/project-module';
import { assignProjectWorkspaceOp } from '#/modules/project/operations/assign-project-workspace';
import { createProjectsOp } from '#/modules/project/operations/create-projects';
import { deleteProjectsOp } from '#/modules/project/operations/delete-projects';
import { getProjectOp } from '#/modules/project/operations/get-project';
import { getProjectsOp } from '#/modules/project/operations/get-projects';
import { moveProjectToWorkspaceOp } from '#/modules/project/operations/move-project-workspace';
import { removeProjectWorkspaceOp } from '#/modules/project/operations/remove-project-workspace';
import { updateProjectOp } from '#/modules/project/operations/update-project';
import projectRoutes from '#/modules/project/project-routes';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });
const listApp = new OpenAPIHono<Env>({ defaultHook });

app.openapi(projectRoutes.createProjects, async (ctx) => {
  const { workspaceId } = ctx.req.valid('query');
  const data = await createProjectsOp(ctx, ctx.req.valid('json'), workspaceId);
  return ctx.json(data, 201);
});

app.openapi(projectRoutes.getProject, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { slug: bySlug, include } = ctx.req.valid('query');
  const data = await getProjectOp(ctx, id, { bySlug, include });
  return ctx.json(data, 200);
});

app.openapi(projectRoutes.updateProject, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const data = await updateProjectOp(ctx, id, ctx.req.valid('json'));
  return ctx.json(data, 200);
});

app.openapi(projectRoutes.assignProjectWorkspace, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { workspaceId } = ctx.req.valid('query');
  const data = await assignProjectWorkspaceOp(ctx, id, workspaceId);
  return ctx.json(data, 200);
});

app.openapi(projectRoutes.removeProjectWorkspace, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const data = await removeProjectWorkspaceOp(ctx, id);
  return ctx.json(data, 200);
});

app.openapi(projectRoutes.moveProjectToWorkspace, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { workspaceId } = ctx.req.valid('query');
  const data = await moveProjectToWorkspaceOp(ctx, id, workspaceId);
  return ctx.json(data, 200);
});

app.openapi(projectRoutes.deleteProjects, async (ctx) => {
  const { ids } = ctx.req.valid('json');
  const data = await deleteProjectsOp(ctx, Array.isArray(ids) ? ids : [ids]);
  return ctx.json(data, 200);
});

export const projectListHandlers = listApp;

export const projectHandlers = app;

listApp.openapi(projectRoutes.getProjects, async (ctx) => {
  const data = await getProjectsOp(ctx, ctx.req.valid('query'));
  return ctx.json(data, 200);
});
