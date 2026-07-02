import { and, eq, getColumns, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type { AuthContext, DbContext } from '#/core/context';
import { contextCountersTable } from '#/modules/entities/context-counters-db';
import { labelsTable } from '#/modules/label/label-db';

interface FindLabelsByStxMutationIdOpts {
  mutationId: string;
}

/** Find labels by their STX mutation ID (idempotency check). */
export const findLabelsByStxMutationId = async (ctx: AuthContext, { mutationId }: FindLabelsByStxMutationIdOpts) => {
  const { db, organizationId } = ctx.var;
  return db
    .select()
    .from(labelsTable)
    .where(and(sql`${labelsTable.stx}->>'mutationId' = ${mutationId}`, eq(labelsTable.organizationId, organizationId)));
};

/** Find all labels in an organization (used for duplicate/color matching). */
export const findLabelsByOrg = async (ctx: AuthContext) => {
  const { db, organizationId } = ctx.var;
  return db.select().from(labelsTable).where(eq(labelsTable.organizationId, organizationId));
};

/** Insert labels and return the created records. Silently skips duplicates (PK conflict). */
export const insertLabels = async (ctx: DbContext, { labels }: { labels: (typeof labelsTable.$inferInsert)[] }) => {
  const { db } = ctx.var;
  return db.insert(labelsTable).values(labels).onConflictDoNothing().returning();
};

interface UpdateLabelOpts {
  id: string;
  values: Partial<typeof labelsTable.$inferInsert>;
}

/** Update a label by ID and return the updated record. */
export const updateLabel = async (ctx: AuthContext, { id, values }: UpdateLabelOpts) => {
  const { db, organizationId } = ctx.var;
  const [updated] = await db
    .update(labelsTable)
    .set(values)
    .where(and(eq(labelsTable.id, id), eq(labelsTable.organizationId, organizationId)))
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
  const { db, organizationId } = ctx.var;
  return db
    .update(labelsTable)
    .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
    .where(
      and(inArray(labelsTable.id, ids), eq(labelsTable.organizationId, organizationId), isNull(labelsTable.deletedAt)),
    );
};

interface DeleteCountersByKeysOpts {
  keys: string[];
}

/** Delete context counters by keys. */
export const deleteCountersByKeys = async (ctx: DbContext, { keys }: DeleteCountersByKeysOpts) => {
  const { db } = ctx.var;
  return db.delete(contextCountersTable).where(inArray(contextCountersTable.contextKey, keys));
};

interface FindLabelUsedCountOpts {
  labelId: string;
}

/** Get a label's used count from context counters. */
export const findLabelUsedCount = async (ctx: DbContext, { labelId }: FindLabelUsedCountOpts) => {
  const { db } = ctx.var;
  const [counters] = await db
    .select({ usedCount: sql<number>`coalesce((${contextCountersTable.counts}->>'e:task')::int, 0)` })
    .from(contextCountersTable)
    .where(eq(contextCountersTable.contextKey, labelId))
    .limit(1);
  return counters?.usedCount ?? 0;
};

/** Build the labels list query with counter join and filters. Returns a subquery. */
export const buildLabelsListQuery = (ctx: AuthContext, { filters }: { filters: SQL[] }) => {
  const { db, organizationId } = ctx.var;
  return db
    .select({
      ...getColumns(labelsTable),
      usedCount: sql<number>`coalesce((${contextCountersTable.counts}->>'e:task')::int, 0)`.as('used_count'),
    })
    .from(labelsTable)
    .leftJoin(contextCountersTable, sql`${contextCountersTable.contextKey} = ${labelsTable.id}::text`)
    .where(and(eq(labelsTable.organizationId, organizationId), ...filters));
};
