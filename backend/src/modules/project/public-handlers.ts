import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '#/core/context';
import { AppError } from '#/core/error';
import { unsafeInternalAdminDb } from '#/db/db';
import { resolveEntity } from '#/modules/entities/entities-queries';
import { publicProjectRoutes } from '#/modules/project/public-routes';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { buildSubject, checkPermission } from '#/permissions';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(publicProjectRoutes.getPublicProject, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { slug: bySlug } = ctx.req.valid('query');
  const entityType = 'project';

  const project = await resolveEntity({ var: { db: unsafeInternalAdminDb! } }, entityType, id, bySlug);
  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType });

  // Anonymous engine check: readable only via the declared public read grant
  // (publicRead('publicSelf') in permissions-config — matches when project.publicAt is set).
  const subject = buildSubject(entityType, project, { id: project.id, row: project });
  if (!checkPermission([], 'read', subject).isAllowed) {
    throw new AppError(403, 'forbidden', 'warn', { entityType, meta: { organizationId: project.organizationId } });
  }

  const projectWithAudit = await withAuditUser(ctx, project);
  const projectResponse = { ...projectWithAudit, membership: null, included: {} };

  return ctx.json(projectResponse, 200);
});

export const publicProjectHandlers = app;
