import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { OperationResult } from '#/core/operation-result';
import { tenantRead, tenantReadIncludingDeleted } from '#/db/tenant-context';
import { getTasks } from '#/modules/task/helpers/get-tasks';
import { findProjectById, findProjectsByWorkspace } from '#/modules/task/task-queries';
import type { taskListQuerySchema } from '#/modules/task/task-schema';
import { actorFrom } from '#/permissions/actor';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';

type GetTasksInput = z.infer<typeof taskListQuerySchema>;

export async function getTasksOp(
  ctx: AuthContext,
  input: GetTasksInput,
): Promise<OperationResult<Awaited<ReturnType<typeof getTasks>>>> {
  const { projectId, workspaceId, ...queryInfo } = input;
  const organizationId = ctx.var.organization.id;

  // Resolve the explicit sub-context narrowing (if any) from the request.
  let requested: { subChannelId?: string; subChannelIds?: string[] } | undefined;
  if (workspaceId) {
    // ?workspaceId=…: restrict to the workspace's projects the caller may read.
    const workspaceProjects = await tenantRead(ctx, (readCtx) => findProjectsByWorkspace(readCtx, { workspaceId }));
    requested = { subChannelIds: workspaceProjects.map(({ id }) => id) };
  }
  if (projectId) {
    // ?projectId=…: must exist and be within the caller's readable scope.
    const project = await tenantRead(ctx, (readCtx) => findProjectById(readCtx, { projectId }));
    if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });
    requested = { subChannelId: projectId };
  }

  // Scope to the caller's readable projects; undefined means org-wide (all readable projects).
  const { subChannelIds: projectIds } = resolveCollectionReadFilter(
    ctx.var.memberships,
    'task',
    organizationId,
    actorFrom(ctx),
    requested,
  );

  // Tasks always require an explicit project scope (no org-wide aggregate read).
  if (!projectIds || projectIds.length === 0) {
    return { success: true, data: { items: [], total: 0 } };
  }
  const scopedProjectIds = projectIds;

  // Delta sync (seqCursor) must see tombstones so the client can remove soft-deleted tasks
  const read = queryInfo.seqCursor ? tenantReadIncludingDeleted : tenantRead;

  const response = await read(ctx, async (readCtx) => {
    return getTasks(readCtx, scopedProjectIds, queryInfo);
  });

  return { success: true, data: response };
}
