import type { z } from '@hono/zod-openapi';
import { and, asc, count, eq, getColumns, ilike, isNull, or, type SQL, sql } from 'drizzle-orm';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { OperationResult } from '#/core/operation-result';
import { tenantRead, tenantReadIncludingDeleted } from '#/db/tenant-context';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import type { attachmentListQuerySchema } from '#/modules/attachment/attachment-schema';
import { type ListTotalSource, resolveListTotal } from '#/modules/entities/helpers/list-total';
import { productCountersTable } from '#/modules/entities/product-counters-db';
import { findProjectById } from '#/modules/task/task-queries';
import { auditUserSelect, coalesceAuditUsers, createdByUser, updatedByUser } from '#/modules/user/helpers/audit-user';
import { actorFrom } from '#/permissions/actor';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';
import { buildCollectionReadWhere } from '#/permissions/row-predicates';
import { getOrderColumn } from '#/utils/order-column';
import { seqCursorFilters } from '#/utils/seq-cursor';
import { prepareStringForILikeFilter } from '#/utils/sql';

type GetAttachmentsInput = z.infer<typeof attachmentListQuerySchema>;

export async function getAttachmentsOp(ctx: AuthContext, input: GetAttachmentsInput) {
  const organizationId = ctx.var.organization.id;
  const { q, sort, order, limit, offset, seqCursor, projectId } = input;

  // cella change: Validate an explicitly requested project exists before scoping the read to it.
  if (projectId) {
    const project = await tenantRead(ctx, (readCtx) => findProjectById(readCtx, { projectId }));
    if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });
  }

  // cella change: Resolve the caller's readable scope (unconditional projects + row-conditional
  // slices, e.g. `read: 'own'`) and compile it to a single row predicate.
  const actor = actorFrom(ctx);
  const readFilter = resolveCollectionReadFilter(
    ctx.var.memberships,
    'attachment',
    organizationId,
    actor,
    projectId ? { subChannelId: projectId } : undefined,
  );
  const scopeWhere = buildCollectionReadWhere(readFilter, attachmentsTable, attachmentsTable.projectId, actor);

  if (scopeWhere.kind === 'none') {
    const data = { items: [], total: 0 };
    return { success: true, data } as OperationResult<typeof data>;
  }

  const filters: SQL[] = [eq(attachmentsTable.organizationId, organizationId)];

  // Restrict to the caller's readable scope unless org-wide (kind 'all').
  if (scopeWhere.kind === 'where') filters.push(scopeWhere.where);

  // Hide tombstones for normal reads; on delta sync they flow through so caches can drop them
  if (!seqCursor) {
    filters.push(isNull(attachmentsTable.deletedAt));
  }

  // Sequence-based delta sync filter
  filters.push(...seqCursorFilters(attachmentsTable.seq, seqCursor));

  if (q?.trim()) {
    const queryToken = prepareStringForILikeFilter(q.trim());
    filters.push(
      or(
        ilike(attachmentsTable.name, queryToken),
        ilike(attachmentsTable.filename, queryToken),
        ilike(attachmentsTable.contentType, queryToken),
      ) as SQL,
    );
  }

  // Seq reads are keyset-paged: seq order (id tiebreak) makes a capped page a clean prefix
  const orderBy = seqCursor
    ? [asc(attachmentsTable.seq), asc(attachmentsTable.id)]
    : [
        getOrderColumn(sort, attachmentsTable.createdAt, order, {
          name: attachmentsTable.name,
          createdAt: attachmentsTable.createdAt,
          contentType: attachmentsTable.contentType,
        }),
      ];

  // Delta sync (seqCursor) must see tombstones so the client can remove soft-deleted attachments
  const read = seqCursor ? tenantReadIncludingDeleted : tenantRead;

  // Delta reads discard `total`; org-wide unfiltered reads use the O(1) channel counter; everything
  // narrower (search / row-scoped 'own') falls back to the exact COUNT(*).
  const isDelta = !!seqCursor;
  const counterEligible = scopeWhere.kind === 'all' && !q?.trim() && !seqCursor;

  const { items: rawItems, total } = await read(ctx, async (readCtx) => {
    const { db } = readCtx.var;
    const { createdBy: _cb, updatedBy: _mb, ...attachmentCols } = getColumns(attachmentsTable);

    const whereClause = and(...filters);

    const itemsQuery = db
      .select({
        ...attachmentCols,
        ...auditUserSelect,
        viewCount: sql<number>`coalesce(${productCountersTable.viewCount}, 0)`.as('view_count'),
      })
      .from(attachmentsTable)
      .leftJoin(productCountersTable, eq(productCountersTable.productId, attachmentsTable.id))
      .leftJoin(createdByUser, eq(createdByUser.id, attachmentsTable.createdBy))
      .leftJoin(updatedByUser, eq(updatedByUser.id, attachmentsTable.updatedBy))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const totalSource: ListTotalSource = isDelta
      ? { kind: 'pageLength' }
      : counterEligible
        ? { kind: 'counter', ctx: readCtx, channelKey: organizationId, entityType: 'attachment' }
        : {
            kind: 'exact',
            count: async () => {
              const [{ total }] = await db.select({ total: count() }).from(attachmentsTable).where(whereClause);
              return total;
            },
          };

    return resolveListTotal(itemsQuery, totalSource);
  });

  const items = coalesceAuditUsers(rawItems);
  const data = { items, total };
  return { success: true, data } as OperationResult<typeof data>;
}
