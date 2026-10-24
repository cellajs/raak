import { and, asc, count, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { PrimaryLabelDefinition } from 'shared/config/labels-config';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import type { ActorContext, DbContext } from '#/core/context';
import type { ActorId } from '#/db/utils/ids';
import { type ListTotalSource, resolveListTotal } from '#/db/utils/list-total';
import { requestScopeWhere } from '#/db/utils/request-scope';
import { deleteStamps, updateStamps } from '#/db/utils/stamps';
import { stripChangedFields } from '#/db/utils/strip-changed-fields';
import { getOrganizationEntityCount } from '#/modules/entities/entities-queries';
import { type LabelModel, labelsTable } from '#/modules/label/label-db';
import { getOrderColumns } from '#/utils/order-column';
import { type SeqRange, seqRangeRead } from '#/utils/seq-range';
import { textSearchFilter } from '#/utils/sql';

/** Find all labels in an organization (used for duplicate/color matching). */
export const findLabelsByOrg = async (ctx: ActorContext) => {
  const { db } = ctx.var;
  return db
    .select()
    .from(labelsTable)
    .where(requestScopeWhere(ctx, labelsTable, 'label'));
};

interface InsertLabelsOpts {
  labels: (typeof labelsTable.$inferInsert)[];
}

/** Insert labels and return the created rows. Silently skips duplicates (PK conflict). */
export const insertLabels = async (ctx: DbContext, { labels }: InsertLabelsOpts) => {
  const { db } = ctx.var;
  return db.insert(labelsTable).values(labels).onConflictDoNothing().returning();
};

export type UpdateLabelValues = PgUpdateSetSource<typeof labelsTable>;

interface UpdateLabelOpts {
  id: string;
  values: UpdateLabelValues;
}

/** Update a label by ID and return the updated row. */
export const updateLabel = async (ctx: ActorContext, { id, values }: UpdateLabelOpts) => {
  const { db } = ctx.var;
  const [updated] = await db
    .update(labelsTable)
    .set(values)
    .where(and(eq(labelsTable.id, id), requestScopeWhere(ctx, labelsTable, 'label')))
    .returning();
  return updated;
};

interface DeleteLabelsByIdsOpts {
  ids: string[];
  /** Who deletes: stamped as the tombstone and as the row's last write. */
  actorId: ActorId;
}

/** Soft-delete labels by IDs. */
export const deleteLabelsByIds = async (ctx: ActorContext, { ids, actorId }: DeleteLabelsByIdsOpts) => {
  const { db } = ctx.var;
  return db
    .update(labelsTable)
    .set(deleteStamps(actorId))
    .where(and(inArray(labelsTable.id, ids), requestScopeWhere(ctx, labelsTable, 'label'), isNull(labelsTable.deletedAt)))
    .returning();
};

/** Live primary labels for a set of projects, ordered by displayOrder (default first). Runs inside a tenant context. */
export const findLivePrimaryLabels = async (ctx: ActorContext, { projectIds }: { projectIds: string[] }): Promise<LabelModel[]> => {
  if (projectIds.length === 0) return [];
  const { db } = ctx.var;
  return db
    .select()
    .from(labelsTable)
    .where(
      and(
        inArray(labelsTable.projectId, projectIds),
        requestScopeWhere(ctx, labelsTable, 'label'),
        eq(labelsTable.mode, 'primary'),
        isNull(labelsTable.deletedAt),
      ),
    )
    .orderBy(asc(labelsTable.displayOrder));
};

/** Slug of a label row by id (any mode or deletion state); null when the row is unknown. */
export const findLabelSlugById = async (ctx: ActorContext, id: string): Promise<string | null> => {
  const { db } = ctx.var;
  const [row] = await db
    .select({ slug: labelsTable.slug })
    .from(labelsTable)
    .where(and(eq(labelsTable.id, id), requestScopeWhere(ctx, labelsTable, 'label')))
    .limit(1);
  return row?.slug ?? null;
};

/** Name of a label row by id with no request scope, for callers that resolve it outside a tenant; null when unknown. */
export const findLabelNameById = async (ctx: DbContext, id: string): Promise<string | null> => {
  const [row] = await ctx.var.db.select({ name: labelsTable.name }).from(labelsTable).where(eq(labelsTable.id, id)).limit(1);
  return row?.name ?? null;
};

/** Mode and project of the live labels among `ids`. */
export const findLiveLabelModes = async (ctx: ActorContext, { ids }: { ids: string[] }) => {
  const { db } = ctx.var;
  return db
    .select({ id: labelsTable.id, mode: labelsTable.mode, projectId: labelsTable.projectId })
    .from(labelsTable)
    .where(and(inArray(labelsTable.id, ids), requestScopeWhere(ctx, labelsTable, 'label'), isNull(labelsTable.deletedAt)));
};

/** How many live primary labels a project has. */
export const countLivePrimaryLabels = async (ctx: ActorContext, { projectId }: { projectId: string }): Promise<number> => {
  const { db } = ctx.var;
  const [{ liveCount }] = await db
    .select({ liveCount: count() })
    .from(labelsTable)
    .where(
      and(
        eq(labelsTable.projectId, projectId),
        requestScopeWhere(ctx, labelsTable, 'label'),
        eq(labelsTable.mode, 'primary'),
        isNull(labelsTable.deletedAt),
      ),
    );
  return liveCount;
};

interface PropagateSetupConfigLabelsOpts {
  entries: PrimaryLabelDefinition[];
  organizationId: string;
  updatedBy: ActorId;
}

/**
 * Propagate edited setupConfig entries onto still-tracked primary rows across all of the
 * organization's projects, matched by slug. Unlinked rows (organizationTracked=false) and
 * per-project displayOrder are left alone. Server-origin write, so the stored stx drops its
 * changedFields. Runs inside a tenant context. The organization update route has no orgGuard,
 * so the scope is the organization id passed in.
 */
export const propagateSetupConfigLabels = async (
  ctx: DbContext,
  { entries, organizationId, updatedBy }: PropagateSetupConfigLabelsOpts,
): Promise<void> => {
  const { db } = ctx.var;
  for (const entry of entries) {
    await db
      .update(labelsTable)
      .set({ name: entry.name, color: entry.color, icon: entry.icon, ...updateStamps(updatedBy), stx: stripChangedFields(labelsTable.stx) })
      .where(
        and(
          eq(labelsTable.organizationId, organizationId),
          eq(labelsTable.slug, entry.slug),
          eq(labelsTable.mode, 'primary'),
          eq(labelsTable.organizationTracked, true),
          isNull(labelsTable.deletedAt),
        ),
      );
  }
};

interface FindLabelsPaginatedOpts {
  organizationId: string;
  /** The caller's read scope, from the permission layer; the request scope is added here. */
  filters: SQL[];
  /** The read scope is the whole organization, so an unfiltered total can come from the counter. */
  orgWide: boolean;
  q?: string;
  modes?: LabelModel['mode'][];
  sort?: 'name';
  order?: 'asc' | 'desc';
  limit: number;
  offset: number;
  /** A range read for sync: deleted rows included, in sequence order, total from the page length. */
  range?: SeqRange;
}

/**
 * A page of labels. Normal reads hide deleted rows; a range read passes them through so caches can drop them. The total
 * is the page length for a range read, the organization counter for an org-wide read without search or mode filter,
 * else a COUNT.
 */
export const findLabelsPaginated = async (ctx: ActorContext, opts: FindLabelsPaginatedOpts) => {
  const { db } = ctx.var;
  const { organizationId, orgWide, q, modes, sort, order, limit, offset, range } = opts;
  const rangeRead = seqRangeRead(labelsTable, range);
  const filters = [...opts.filters, ...rangeRead.where];

  // Tokenized search over name and description-derived keywords, as task keyword matching does: every word must hit
  // (AND across words, OR across columns per word). parseSearchQuery strips the '=' highlight marker.
  for (const word of parseSearchQuery(q).terms) {
    const wordFilter = or(textSearchFilter(labelsTable.name, word), textSearchFilter(labelsTable.keywords, word));
    if (wordFilter) filters.push(wordFilter);
  }
  if (modes?.length) filters.push(inArray(labelsTable.mode, modes));

  const whereClause = and(requestScopeWhere(ctx, labelsTable, 'label'), ...filters);

  const orderBy =
    rangeRead.orderBy ?? getOrderColumns({ sort, order, fallback: ['name', 'asc'], columns: { name: labelsTable.name }, tieBreaker: labelsTable.id });

  const itemsQuery = db
    .select()
    .from(labelsTable)
    .where(whereClause)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const counterEligible = orgWide && !q?.trim() && !range && !modes?.length;
  const totalSource: ListTotalSource = range
    ? { kind: 'pageLength' }
    : counterEligible
      ? { kind: 'counter', getTotal: () => getOrganizationEntityCount(ctx, { organizationId, entityType: 'label' }) }
      : {
          kind: 'exact',
          getTotal: async () => {
            const [{ total }] = await db.select({ total: count() }).from(labelsTable).where(whereClause);
            return total;
          },
        };

  return resolveListTotal(itemsQuery, totalSource);
};
