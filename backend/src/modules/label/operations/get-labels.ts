import type { z } from '@hono/zod-openapi';
import type { SQL } from 'drizzle-orm';
import type { OrgContext } from '#/core/context';
import { AppError } from '#/core/error';
import { tenantRead, tenantReadIncludingDeleted } from '#/db/tenant-context';
import type { LabelModel } from '#/modules/label/label-db';
import { labelsTable } from '#/modules/label/label-db';
import { findLabelsPaginated } from '#/modules/label/label-queries';
import type { labelListQuerySchema } from '#/modules/label/label-schema';
import { findProjectById, findProjectsByWorkspace } from '#/modules/task/task-queries';
import { actorFrom } from '#/permissions/access';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';
import { buildCollectionReadWhere } from '#/permissions/row-predicates';

type GetLabelsInput = z.infer<typeof labelListQuerySchema>;

export async function getLabelsOp(ctx: OrgContext, input: GetLabelsInput): Promise<{ items: (LabelModel & { usedCount: number })[]; total: number }> {
  const { projectId, workspaceId, ...queryInfo } = input;
  const { q, sort, order, offset, limit, seqCursor, modes } = queryInfo;
  const organizationId = ctx.var.organization.id;

  // Resolve the explicit channel narrowing (if any) from the request.
  let requested: { homeChannelId?: string; homeChannelIds?: string[] } | undefined;
  if (workspaceId) {
    // ?workspaceId=…: restrict to the workspace's projects the caller may read.
    const workspaceProjects = await tenantRead(ctx, (readCtx) => findProjectsByWorkspace(readCtx, { workspaceId }));
    requested = { homeChannelIds: workspaceProjects.map(({ id }) => id) };
  }
  if (projectId) {
    // ?projectId=…: must exist and be within the caller's readable scope.
    const project = await tenantRead(ctx, (readCtx) => findProjectById(readCtx, { projectId }));
    if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });
    requested = { homeChannelId: projectId };
  }

  // Resolve the caller's readable scope (unconditional projects + row-conditional slices,
  // e.g. `read: 'own'`) and compile it to a single row predicate.
  const actor = actorFrom(ctx);
  const readFilter = resolveCollectionReadFilter(ctx.var.actor.bindings, 'label', organizationId, actor, requested);
  const scopeWhere = buildCollectionReadWhere(readFilter, labelsTable, labelsTable.projectId, actor);

  if (scopeWhere.kind === 'none') {
    return { items: [], total: 0 };
  }

  // Restrict to the caller's readable scope unless org-wide (kind 'all').
  const filters: SQL[] = scopeWhere.kind === 'where' ? [scopeWhere.where] : [];

  // Delta sync (seqCursor) must see tombstones so the client can remove soft-deleted labels
  const read = seqCursor ? tenantReadIncludingDeleted : tenantRead;
  return read(ctx, (readCtx) =>
    findLabelsPaginated(readCtx, { organizationId, filters, orgWide: scopeWhere.kind === 'all', q, modes, sort, order, limit, offset, seqCursor }),
  );
}
