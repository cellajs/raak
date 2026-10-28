import type { z } from '@hono/zod-openapi';
import type { SQL } from 'drizzle-orm';
import type { OrgContext } from '#/core/context';
import { tenantRead, tenantReadIncludingDeleted } from '#/db/tenant-context';
import type { LabelModel } from '#/modules/label/label-db';
import { labelsTable } from '#/modules/label/label-db';
import { findLabelsPaginated } from '#/modules/label/label-queries';
import type { labelListQuerySchema } from '#/modules/label/label-schema';
import { resolveProjectNarrowing } from '#/modules/project/project-queries';
import { actorFrom } from '#/permissions/access';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';
import { buildCollectionReadWhere } from '#/permissions/row-predicates';
import { seqRangeOf } from '#/utils/seq-range';

type GetLabelsInput = z.infer<typeof labelListQuerySchema>;

/**
 * A page of the labels the caller may read in the organization; `projectId` or `workspaceId` narrows it. A range read
 * (`afterSeq`, `untilSeq`) includes deleted rows.
 */
export async function getLabelsOp(ctx: OrgContext, input: GetLabelsInput): Promise<{ items: LabelModel[]; total: number }> {
  const { projectId, workspaceId, ...queryInfo } = input;
  const { q, sort, order, offset, limit, modes } = queryInfo;
  const range = seqRangeOf(queryInfo);
  const organizationId = ctx.var.organization.id;

  const requested = await resolveProjectNarrowing(ctx, { projectId, workspaceId });

  // Resolve the caller's readable scope (unconditional projects + row-conditional slices,
  // e.g. `read: 'own'`) and compile it to a single row predicate.
  const actor = actorFrom(ctx);
  const readFilter = resolveCollectionReadFilter(ctx.var.actor.bindings, 'label', organizationId, actor, requested);
  const scopeWhere = buildCollectionReadWhere(readFilter, labelsTable, 'label', actor);

  if (scopeWhere.kind === 'none') {
    return { items: [], total: 0 };
  }

  // Restrict to the caller's readable scope unless org-wide (kind 'all').
  const filters: SQL[] = scopeWhere.kind === 'where' ? [scopeWhere.where] : [];

  // A range read returns deleted rows too, so caches drop them.
  const read = range ? tenantReadIncludingDeleted : tenantRead;
  return read(ctx, (readCtx) =>
    findLabelsPaginated(readCtx, { organizationId, filters, orgWide: scopeWhere.kind === 'all', q, modes, sort, order, limit, offset, range }),
  );
}
