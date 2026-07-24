import type { Block } from '@blocknote/core';
import { OpenAPIHono } from '@hono/zod-openapi';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { html, raw } from 'hono/html';
import { appConfig } from 'shared';
import { unsafeInternalAdminDb } from '#/db/db';

const db = unsafeInternalAdminDb!;

import { getTextFromBlock } from 'shared/blocknote';
import type { Env } from '#/core/context';
import { AppError } from '#/core/error';
import { labelsTable } from '#/modules/label/label-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { generateCover } from '#/modules/task/helpers/canvas';
import { taskRedirectRoutes } from '#/modules/task/redirect-routes';
import { tasksTable } from '#/modules/task/task-db';
import { userMinimalBaseSelect } from '#/modules/user/helpers/select';
import { type UserModel, usersTable } from '#/modules/user/user-db';
import { defaultHook } from '#/utils/default-hook';

const app = new OpenAPIHono<Env>({ defaultHook });

/** Display name of a task's primary label (task type); falls back to 'Task'. */
const getTaskType = async (primaryLabelId: string) => {
  const [label] = await db
    .select({ name: labelsTable.name })
    .from(labelsTable)
    .where(eq(labelsTable.id, primaryLabelId))
    .limit(1);
  return label?.name ?? 'Task';
};

app.openapi(taskRedirectRoutes.resolveTaskLink, async (ctx) => {
  const { id } = ctx.req.valid('param');

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), isNull(tasksTable.deletedAt)))
    .limit(1);
  if (!task) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });

  const [project] = await db
    .select({
      slug: projectsTable.slug,
      organizationId: projectsTable.organizationId,
      tenantId: projectsTable.tenantId,
      publicAt: projectsTable.publicAt,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, task.projectId))
    .limit(1);

  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });

  const [organization] = await db
    .select({ slug: organizationsTable.slug })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, project.organizationId))
    .limit(1);

  if (!organization) throw new AppError(404, 'not_found', 'warn', { entityType: 'organization' });

  return ctx.json(
    {
      taskId: id,
      projectId: task.projectId,
      projectSlug: project.slug,
      organizationId: project.organizationId,
      organizationSlug: organization.slug,
      tenantId: project.tenantId,
      publicAt: project.publicAt,
    },
    200,
  );
});

app.openapi(taskRedirectRoutes.getTaskCover, async (ctx) => {
  const { id } = ctx.req.valid('param');

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), isNull(tasksTable.deletedAt)));

  if (!task) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });
  let createdByUser: Partial<UserModel> | undefined;

  if (task.createdBy) {
    [createdByUser] = await db
      .select({ ...userMinimalBaseSelect, entityType: sql<'user'>`'user'` })
      .from(usersTable)
      .where(eq(usersTable.id, task.createdBy));
  }

  const png = await generateCover({
    title: task.summary,
    avatarUrl: createdByUser?.thumbnailUrl || '',
    name: createdByUser?.name || '',
  });

  return new Response(Buffer.from(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
      'Cache-Control': 'public, max-age=3600, immutable',
    },
  });
});

app.openapi(taskRedirectRoutes.redirectToTask, async (ctx) => {
  const { id } = ctx.req.valid('param');

  const [taskRecord] = await db
    .select({ task: tasksTable, createdBy: usersTable })
    .from(tasksTable)
    .leftJoin(usersTable, eq(usersTable.id, tasksTable.createdBy))
    .where(and(eq(tasksTable.id, id), isNull(tasksTable.deletedAt)))
    .limit(1);
  if (!taskRecord)
    throw new AppError(404, 'not_found', 'warn', {
      entityType: 'task',
      willRedirect: true,
    });

  const { task, createdBy } = taskRecord;
  // Find a project to show the task in.
  const [project] = await db
    .select({ slug: projectsTable.slug, name: projectsTable.name, entity: projectsTable.entityType })
    .from(projectsTable)
    .where(eq(projectsTable.id, task.projectId))
    .limit(1);

  // No matching project found
  if (!project)
    throw new AppError(404, 'not_found', 'warn', {
      entityType: 'project',
      willRedirect: true,
    });

  const url = new URL(`${appConfig.frontendUrl}/t/${id}`);
  const redirectUrl = url.toString();

  const blocks = JSON.parse(task.description ?? '[]') as Block[];
  const fullText = blocks.map(getTextFromBlock).join(' ').trim();

  const createdAtDate = new Date(task.createdAt);
  const now = new Date();

  const sameYear = createdAtDate.getFullYear() === now.getFullYear();
  const formattedDate = createdAtDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });

  const taskType = await getTaskType(task.primaryLabelId);
  const taskTitle = `${taskType} in ${project.name || 'Project'} - ${formattedDate}${createdBy ? ` by ${createdBy.name}` : ''}`;
  const taskDescription = fullText.length > 200 ? `${fullText.slice(0, 197)}...` : fullText;

  // <meta name="twitter:image" content="${config.backendUrl}/${task.organizationId}/tasks/${id}/cover"/>
  // <meta property="og:image" content="${config.backendUrl}/${task.organizationId}/tasks/${id}/cover"/>
  return ctx.html(html`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${taskTitle}</title>

          <!-- Open Graph -->
          <meta property="og:title" content="${taskType}" />
          <meta property="og:description" content="${taskDescription}" />
          <meta property="og:image" content="${appConfig.frontendUrl}/static/images/thumbnail.png" />
          <meta property="og:url" content="${raw(redirectUrl)}" />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Raak" />
          <meta property="og:locale" content="en_US" />

          <meta name="robots" content="index,follow" />
        </head>

        <script>
          ${raw(`window.location.href = "${redirectUrl}";`)}
        </script>
      </html>
    `);
});

export const taskRedirectHandlers = app;
