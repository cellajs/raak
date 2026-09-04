import { and, eq, getColumns, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import { appConfig } from 'shared';
import type { AuthContext, DbContext } from '#/core/context';
import { requestScopeWhere } from '#/db/utils/request-scope';
import { channelCountersTable } from '#/modules/entities/channel-counters-db';
import { labelsTable } from '#/modules/label/label-db';

/**
 * Counter key holding host references to a label, written by CDC per embedded id
 * as `e:c:<hostProduct>` (see cdc getCountDeltas). Derived from the same embedding
 * config so reader and writer cannot drift apart.
 */
export const labelUsedCountKey = `e:c:${
  appConfig.productEmbeddings.find((e) => e.embeddedProduct === 'label')?.hostProduct ?? 'task'
}`;

interface FindLabelsByStxMutationIdOpts {
  mutationId: string;
}

export const findLabelsByStxMutationId = async (ctx: AuthContext, { mutationId }: FindLabelsByStxMutationIdOpts) => {
  const { db } = ctx.var;
  return db
    .select()
    .from(labelsTable)
    .where(and(sql`${labelsTable.stx}->>'mutationId' = ${mutationId}`, requestScopeWhere(ctx, labelsTable, 'label')));
};

/** Find all labels in an organization (used for duplicate/color matching). */
export const findLabelsByOrg = async (ctx: AuthContext) => {
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

interface UpdateLabelOpts {
  id: string;
  values: Partial<typeof labelsTable.$inferInsert>;
}

/** Update a label by ID and return the updated row. */
export const updateLabel = async (ctx: AuthContext, { id, values }: UpdateLabelOpts) => {
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
export const deleteLabelsByIds = async (ctx: AuthContext, { ids, deletedAt, deletedBy }: DeleteLabelsByIdsOpts) => {
  const { db } = ctx.var;
  return db
    .update(labelsTable)
    .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
    .where(
      and(inArray(labelsTable.id, ids), requestScopeWhere(ctx, labelsTable, 'label'), isNull(labelsTable.deletedAt)),
    );
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

interface BuildLabelsListQueryOpts {
  filters: SQL[];
}

/** Build the labels list query with counter join and filters. Returns a subquery. */
export const buildLabelsListQuery = (ctx: AuthContext, { filters }: BuildLabelsListQueryOpts) => {
  const { db } = ctx.var;
  return db
    .select({
      ...getColumns(labelsTable),
      usedCount: sql<number>`coalesce((${channelCountersTable.counts}->>${labelUsedCountKey})::int, 0)`.as(
        'used_count',
      ),
    })
    .from(labelsTable)
    .leftJoin(channelCountersTable, sql`${channelCountersTable.channelKey} = ${labelsTable.id}::text`)
    .where(and(requestScopeWhere(ctx, labelsTable, 'label'), ...filters));
};
