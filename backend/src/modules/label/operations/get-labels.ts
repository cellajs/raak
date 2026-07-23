import type { z } from '@hono/zod-openapi';
import { count, ilike, isNull, type SQL, sql } from 'drizzle-orm';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { OperationResult } from '#/core/operation-result';
import { tenantRead, tenantReadIncludingDeleted } from '#/db/tenant-context';
import { type ListTotalSource, resolveListTotal } from '#/modules/entities/helpers/list-total';
import type { LabelModel } from '#/modules/label/label-db';
import { labelsTable } from '#/modules/label/label-db';
import { buildLabelsListQuery } from '#/modules/label/label-queries';
import type { labelListQuerySchema } from '#/modules/label/label-schema';
import { findProjectById, findProjectsByWorkspace } from '#/modules/task/task-queries';
import { actorFrom } from '#/permissions/access';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';
import { buildCollectionReadWhere } from '#/permissions/row-predicates';
import { getOrderColumn } from '#/utils/order-column';
import { seqCursorFilters } from '#/utils/seq-cursor';

type GetLabelsInput = z.infer<typeof labelListQuerySchema>;

export async function getLabelsOp(
  ctx: AuthContext,
  input: GetLabelsInput,
): Promise<OperationResult<{ items: (LabelModel & { usedCount: number })[]; total: number }>> {
  const { projectId, workspaceId, ...queryInfo } = input;
  const { q, sort, order, offset, limit, seqCursor } = queryInfo;
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
  const readFilter = resolveCollectionReadFilter(ctx.var.memberships, 'label', organizationId, actor, requested);
  const scopeWhere = buildCollectionReadWhere(readFilter, labelsTable, labelsTable.projectId, actor);

  if (scopeWhere.kind === 'none') {
    return { success: true, data: { items: [], total: 0 } };
  }

  // Delta sync (seqCursor) must see tombstones so the client can remove soft-deleted labels
  const read = seqCursor ? tenantReadIncludingDeleted : tenantRead;

  // Delta reads discard `total`; org-wide unfiltered reads use the O(1) channel counter; everything
  // narrower (search / project-scoped / row-scoped 'own') falls back to the exact COUNT(*).
  const isDelta = !!seqCursor;
  const counterEligible = scopeWhere.kind === 'all' && !q?.trim() && !seqCursor;

  const result = await read(ctx, async (readCtx) => {
    const { db } = readCtx.var;

    const labelsFilters: SQL[] = [];

    // Hide tombstones for normal reads; on delta sync they flow through so caches can drop them
    if (!seqCursor) labelsFilters.push(isNull(labelsTable.deletedAt));

    // Sequence-based delta sync filter
    labelsFilters.push(...seqCursorFilters(labelsTable.seq, seqCursor));

    // Restrict to the caller's readable scope unless org-wide (kind 'all').
    if (scopeWhere.kind === 'where') labelsFilters.push(scopeWhere.where);

    // Add more filters
    if (q) labelsFilters.push(ilike(labelsTable.name, `%${q}%`));

    const labelsSubquery = buildLabelsListQuery(readCtx, { filters: labelsFilters }).as('labels');

    // Seq reads are keyset-paged: seq order (id tiebreak) makes a capped page a clean prefix
    const orderBy = seqCursor
      ? [sql`seq asc`, sql`id asc`]
      : [
          getOrderColumn(sort, sql`name`, order, {
            name: sql`name`,
            usedCount: sql`used_count`,
          }),
        ];

    const itemsQuery = db
      .select()
      .from(labelsSubquery)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const totalSource: ListTotalSource = isDelta
      ? { kind: 'pageLength' }
      : counterEligible
        ? { kind: 'counter', ctx: readCtx, channelKey: organizationId, entityType: 'label' }
        : {
            kind: 'exact',
            count: async () => {
              const [{ total }] = await db.select({ total: count() }).from(labelsSubquery);
              return total;
            },
          };

    return resolveListTotal(itemsQuery, totalSource);
  });

  return { success: true, data: result };
}
