import { and, asc, count, eq, getColumns, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { appConfig } from 'shared';
import type { PrimaryLabelDefinition } from 'shared/config/labels-config';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import type { ActorContext, DbContext } from '#/core/context';
import { type ListTotalSource, resolveListTotal } from '#/db/utils/list-total';
import { requestScopeWhere } from '#/db/utils/request-scope';
import { stripChangedFields } from '#/db/utils/strip-changed-fields';
import { channelCountersTable } from '#/modules/entities/channel-counters-db';
import { getOrganizationEntityCount } from '#/modules/entities/entities-queries';
import { type LabelModel, labelsTable } from '#/modules/label/label-db';
import { getIsoDate } from '#/utils/iso-date';
import { getOrderColumns } from '#/utils/order-column';
import { seqCursorFilters } from '#/utils/seq-cursor';

/**
 * Counter key holding host references to a label, written by CDC per embedded id
 * as `e:c:<hostProduct>` (see cdc getCountDeltas). Derived from the same embedding
 * config so reader and writer cannot drift apart.
 */
export const labelUsedCountKey = `e:c:${appConfig.productEmbeddings.find((e) => e.embeddedProduct === 'label')?.hostProduct ?? 'task'}`;

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
  deletedBy: string;
  deletedAt: string;
}

/** Soft-delete labels by IDs. */
export const deleteLabelsByIds = async (ctx: ActorContext, { ids, deletedAt, deletedBy }: DeleteLabelsByIdsOpts) => {
  const { db } = ctx.var;
  return db
    .update(labelsTable)
    .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
    .where(and(inArray(labelsTable.id, ids), requestScopeWhere(ctx, labelsTable, 'label'), isNull(labelsTable.deletedAt)))
    .returning();
};

interface DeleteCountersByKeysOpts {
  keys: string[];
}

export const deleteCountersByKeys = async (ctx: DbContext, { keys }: DeleteCountersByKeysOpts) => {
  const { db } = ctx.var;
  return db.delete(channelCountersTable).where(inArray(channelCountersTable.channelKey, keys));
};

interface GetLabelUsedCountOpts {
  labelId: string;
}

/** Get a label's used count from context counters. */
export const getLabelUsedCount = async (ctx: DbContext, { labelId }: GetLabelUsedCountOpts) => {
  const { db } = ctx.var;
  const [counters] = await db
    .select({ usedCount: sql<number>`coalesce((${channelCountersTable.counts}->>${labelUsedCountKey})::int, 0)` })
    .from(channelCountersTable)
    .where(eq(channelCountersTable.channelKey, labelId))
    .limit(1);
  return counters?.usedCount ?? 0;
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
  updatedBy: string;
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
  const updatedAt = getIsoDate();
  for (const entry of entries) {
    await db
      .update(labelsTable)
      .set({ name: entry.name, color: entry.color, icon: entry.icon, updatedAt, updatedBy, stx: stripChangedFields(labelsTable.stx) })
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
  sort?: 'name' | 'usedCount';
  order?: 'asc' | 'desc';
  limit: number;
  offset: number;
  /** A delta read: tombstones included, ordered by seq, total from the page length. */
  seqCursor?: string;
}

/**
 * A page of labels with their used count. Normal reads hide tombstones; a delta read passes them through so caches can
 * drop rows. The total is the page length for a delta read, the organization counter for an org-wide read without
 * search or mode filter, else a COUNT.
 */
export const findLabelsPaginated = async (ctx: ActorContext, opts: FindLabelsPaginatedOpts) => {
  const { db } = ctx.var;
  const { organizationId, orgWide, q, modes, sort, order, limit, offset, seqCursor } = opts;
  const filters = [...opts.filters];

  if (!seqCursor) filters.push(isNull(labelsTable.deletedAt));
  filters.push(...seqCursorFilters(labelsTable.seq, seqCursor));

  // Tokenized search over name and description-derived keywords, as task keyword matching does: every word must hit
  // (AND across words, OR across columns per word). parseSearchQuery strips the '=' highlight marker.
  const searchWords = parseSearchQuery(q).effectiveQ.toLowerCase().split(/\s+/).filter(Boolean);
  for (const word of searchWords) {
    const wordFilter = or(ilike(labelsTable.name, `%${word}%`), ilike(labelsTable.keywords, `%${word}%`));
    if (wordFilter) filters.push(wordFilter);
  }
  if (modes?.length) filters.push(inArray(labelsTable.mode, modes));

  const labelsSubquery = db
    .select({
      ...getColumns(labelsTable),
      usedCount: sql<number>`coalesce((${channelCountersTable.counts}->>${labelUsedCountKey})::int, 0)`.as('used_count'),
    })
    .from(labelsTable)
    .leftJoin(channelCountersTable, sql`${channelCountersTable.channelKey} = ${labelsTable.id}::text`)
    .where(and(requestScopeWhere(ctx, labelsTable, 'label'), ...filters))
    .as('labels');

  // Seq reads are keyset-paged: seq order (id tiebreak) makes a capped page a clean prefix
  const orderBy = seqCursor
    ? [sql`seq asc`, sql`id asc`]
    : getOrderColumns({ sort, order, fallback: ['name', 'asc'], columns: { name: sql`name`, usedCount: sql`used_count` }, tieBreaker: sql`id` });

  const itemsQuery = db
    .select()
    .from(labelsSubquery)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const counterEligible = orgWide && !q?.trim() && !seqCursor && !modes?.length;
  const totalSource: ListTotalSource = seqCursor
    ? { kind: 'pageLength' }
    : counterEligible
      ? { kind: 'counter', getTotal: () => getOrganizationEntityCount(ctx, { organizationId, entityType: 'label' }) }
      : {
          kind: 'exact',
          getTotal: async () => {
            const [{ total }] = await db.select({ total: count() }).from(labelsSubquery);
            return total;
          },
        };

  return resolveListTotal(itemsQuery, totalSource);
};
