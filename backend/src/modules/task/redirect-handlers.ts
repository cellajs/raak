import { OpenAPIHono } from '@hono/zod-openapi';
import { html, raw } from 'hono/html';
import { appConfig } from 'shared';
import type { DbContext, Env } from '#/core/context';
import { getAdminDb } from '#/db/db';
import { getTaskCoverOp } from '#/modules/task/operations/get-task-cover';
import { getTaskPreviewOp } from '#/modules/task/operations/get-task-preview';
import { resolveTaskLinkOp } from '#/modules/task/operations/resolve-task-link';
import { taskRedirectRoutes } from '#/modules/task/redirect-routes';
import { defaultHook } from '#/utils/default-hook';

// Task links resolve for anonymous visitors, so no tenant context exists to scope RLS by: these routes read as
// admin. Resolved per request so a process without the admin credential still boots and only these routes fail.
const adminCtx = (): DbContext => ({ var: { db: getAdminDb('public task link resolution') } });

// Previews are intentional for private tasks too: whoever holds a link gets the unfurl, the cover and the routing
// metadata, so no route here applies the public-read check of `public-handlers.ts`. Do not add one. Opening the
// task still takes access, which the frontend's `/t/$id` route enforces.
const app = new OpenAPIHono<Env>({ defaultHook });

app.openapi(taskRedirectRoutes.resolveTaskLink, async (ctx) => {
  const { id } = ctx.req.valid('param');
  return ctx.json(await resolveTaskLinkOp(adminCtx(), id), 200);
});

app.openapi(taskRedirectRoutes.getTaskCover, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const png = await getTaskCoverOp(adminCtx(), id);

  return new Response(Buffer.from(png), {
    headers: { 'Content-Type': 'image/png', 'Content-Length': String(png.byteLength), 'Cache-Control': 'public, max-age=3600, immutable' },
  });
});

app.openapi(taskRedirectRoutes.redirectToTask, async (ctx) => {
  const { id } = ctx.req.valid('param');
  const { taskType, title, description, redirectUrl } = await getTaskPreviewOp(adminCtx(), id);

  return ctx.html(html`
      <!DOCTYPE html>
      <html lang="${appConfig.defaultLanguage}">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>

          <!-- Open Graph -->
          <meta property="og:title" content="${taskType}" />
          <meta property="og:description" content="${description}" />
          <meta property="og:image" content="${appConfig.frontendUrl}/static/images/thumbnail.png" />
          <meta property="og:url" content="${raw(redirectUrl)}" />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="${appConfig.name}" />
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
