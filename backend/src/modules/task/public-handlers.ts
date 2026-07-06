import { OpenAPIHono } from '@hono/zod-openapi';
import type { AuthContext, Env } from '#/core/context';
import { AppError } from '#/core/error';
import { unsafeInternalAdminDb } from '#/db/db';
import { resolveEntity } from '#/modules/entities/entities-queries';
import { getTasks } from '#/modules/task/helpers/get-tasks';
import { getTaskRelations, hydrateTask } from '#/modules/task/helpers/hydrate-task';
import { publicTaskRoutes } from '#/modules/task/public-routes';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(publicTaskRoutes.getPublicTask, async (ctx) => {
  const id = ctx.req.param('id');

  // Validate request
  if (!id) throw new AppError(404, 'not_found', 'warn');

  // Get main task
  const mainTask = await resolveEntity({ var: { db: unsafeInternalAdminDb! } }, 'task', id);
  if (!mainTask) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });

  // REMARK no tenant status check — unlike authenticated routes (which reject suspended/archived tenants in tenantGuard),
  const project = await resolveEntity({ var: { db: unsafeInternalAdminDb! } }, 'project', mainTask.projectId);
  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });
  if (!project.publicAt) throw new AppError(403, 'forbidden', 'warn', { entityType: 'project' });

  const publicCtx = { var: { db: unsafeInternalAdminDb!, userId: '', organizationId: '' } } as AuthContext;
  const [users, labels] = await getTaskRelations(publicCtx, { tasks: [mainTask] });

  const taskResponse = hydrateTask(mainTask, users, labels);

  return ctx.json(taskResponse, 200);
});

app.openapi(publicTaskRoutes.getPublicTasks, async (ctx) => {
  const { projectId, ...queryInfo } = ctx.req.valid('query');

  // REMARK no tenant status check — unlike authenticated routes (which reject suspended/archived tenants in tenantGuard),
  const project = await resolveEntity({ var: { db: unsafeInternalAdminDb! } }, 'project', projectId);
  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });
  if (!project.publicAt) throw new AppError(403, 'forbidden', 'warn', { entityType: 'project' });

  const publicCtx = {
    var: { db: unsafeInternalAdminDb!, userId: '', organizationId: project.organizationId },
  } as AuthContext;
  const response = await getTasks(publicCtx, [project.id], queryInfo);
  return ctx.json(response, 200);
});

export const publicTaskHandlers = app;
