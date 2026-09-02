import { OpenAPIHono } from '@hono/zod-openapi';
import { isUnpublishedDraft } from 'shared';
import type { AuthContext, Env } from '#/core/context';
import { AppError } from '#/core/error';
import { unsafeInternalAdminDb } from '#/db/db';
import { resolveEntity } from '#/modules/entities/entities-queries';
import { getTasks } from '#/modules/task/helpers/get-tasks';
import { getTaskRelations, hydrateTask } from '#/modules/task/helpers/hydrate-task';
import { publicTaskRoutes } from '#/modules/task/public-routes';
import { buildSubject, checkAccess } from '#/permissions';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(publicTaskRoutes.getPublicTask, async (ctx) => {
  const id = ctx.req.param('id');

  // Validate request
  if (!id) throw new AppError(404, 'not_found', 'warn');

  const mainTask = await resolveEntity({ var: { db: unsafeInternalAdminDb! } }, { entityType: 'task', identifier: id });
  if (!mainTask) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });

  // Drafts are never publicly readable: they read as absent to non-authors (the anonymous caller).
  if (isUnpublishedDraft(mainTask)) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });

  // Public reads intentionally bypass tenant status checks from tenantGuard.
  // Anonymous engine check: publicRead() makes the task readable once its own publicAt is set
  // (inherited from the parent project at create time, then row-local; no cascade).
  const subject = buildSubject('task', mainTask, { id: mainTask.id, row: mainTask });
  if (!checkAccess({ anonymous: true }, 'read', subject).allowed) {
    throw new AppError(403, 'forbidden', 'warn', { entityType: 'task' });
  }

  // Relation reads (labels incl. the primary label) are org-scoped, so carry the task's org.
  const publicCtx = {
    var: { db: unsafeInternalAdminDb!, userId: '', organizationId: mainTask.organizationId },
  } as AuthContext;
  const [users, labels] = await getTaskRelations(publicCtx, { tasks: [mainTask] });

  const taskResponse = hydrateTask(mainTask, users, labels);

  return ctx.json(taskResponse, 200);
});

app.openapi(publicTaskRoutes.getPublicTasks, async (ctx) => {
  const { projectId, ...queryInfo } = ctx.req.valid('query');

  // Public reads intentionally bypass tenant status checks from tenantGuard. Resolve the project
  // for org scoping only; the project's own publicAt does not gate the list.
  const project = await resolveEntity(
    { var: { db: unsafeInternalAdminDb! } },
    { entityType: 'project', identifier: projectId },
  );
  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });

  const publicCtx = {
    var: { db: unsafeInternalAdminDb!, userId: '', organizationId: project.organizationId },
  } as AuthContext;
  const response = await getTasks(publicCtx, [project.id], queryInfo, { publicOnly: true });
  return ctx.json(response, 200);
});

export const publicTaskHandlers = app;
