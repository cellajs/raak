import type { z } from '@hono/zod-openapi';
import type { OrgContext } from '#/core/context';
import { tenantRead, tenantReadIncludingDeleted } from '#/db/tenant-context';
import { findOrganizationProjectIds, resolveProjectNarrowing } from '#/modules/project/project-queries';
import { getTasks } from '#/modules/task/operations/list-tasks';
import type { taskListQuerySchema } from '#/modules/task/task-schema';
import { actorFrom } from '#/permissions/access';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';

type GetTasksInput = z.infer<typeof taskListQuerySchema>;

export async function getTasksOp(ctx: OrgContext, input: GetTasksInput): Promise<Awaited<ReturnType<typeof getTasks>>> {
  const { projectId, workspaceId, ...queryInfo } = input;
  const organizationId = ctx.var.organization.id;

  const requested = await resolveProjectNarrowing(ctx, { projectId, workspaceId });
  const { homeChannelIds } = resolveCollectionReadFilter(ctx.var.actor.bindings, 'task', organizationId, actorFrom(ctx), requested);

  // No project list means an org-wide reader (an organization admin, a system admin) without a narrowing, e.g. the
  // sync engine's covering delta fetch over several projects: the list hydrates by project, so name them all.
  const scopedProjectIds = homeChannelIds ?? (await findOrganizationProjectIds(ctx));
  if (scopedProjectIds.length === 0) return { items: [], total: 0 };

  // Delta sync (seqCursor) must see tombstones so the client can remove soft-deleted tasks
  const read = queryInfo.seqCursor ? tenantReadIncludingDeleted : tenantRead;

  return read(ctx, async (readCtx) => {
    return getTasks(readCtx, scopedProjectIds, queryInfo);
  });
}
