import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthContext, DbContext } from '#/core/context';
import { inheritPublicAtFromProject } from '#/db/utils/inherit-public-at';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { productCountersTable } from '#/modules/entities/product-counters-db';

interface FindAttachmentsByStxMutationIdOpts {
  mutationId: string;
}

/** Find attachments by their STX mutation ID (idempotency check). */
export const findAttachmentsByStxMutationId = async (
  ctx: AuthContext,
  { mutationId }: FindAttachmentsByStxMutationIdOpts,
) => {
  const { db, organizationId } = ctx.var;
  return db
    .select()
    .from(attachmentsTable)
    .where(
      and(
        sql`${attachmentsTable.stx}->>'mutationId' = ${mutationId}`,
        eq(attachmentsTable.organizationId, organizationId),
      ),
    );
};

interface InsertAttachmentsOpts {
  attachments: (typeof attachmentsTable.$inferInsert)[];
}

/** Insert attachments and return the created rows. Silently skips duplicates (PK conflict). */
export const insertAttachments = async (ctx: DbContext, { attachments }: InsertAttachmentsOpts) => {
  const { db } = ctx.var;
  await inheritPublicAtFromProject(ctx, attachments);
  return db.insert(attachmentsTable).values(attachments).onConflictDoNothing().returning();
};

interface UpdateAttachmentOpts {
  id: string;
  values: Partial<typeof attachmentsTable.$inferInsert>;
}

/** Update an attachment by ID and return the updated row. */
export const updateAttachment = async (ctx: AuthContext, { id, values }: UpdateAttachmentOpts) => {
  const { db, organizationId } = ctx.var;
  const [updated] = await db
    .update(attachmentsTable)
    .set(values)
    .where(and(eq(attachmentsTable.id, id), eq(attachmentsTable.organizationId, organizationId)))
    .returning();
  return updated;
};

interface DeleteAttachmentsByIdsOpts {
  ids: string[];
  deletedBy: string;
  deletedAt: string;
}

/** Soft-delete attachments by IDs. */
export const deleteAttachmentsByIds = async (
  ctx: AuthContext,
  { ids, deletedAt, deletedBy }: DeleteAttachmentsByIdsOpts,
) => {
  const { db, organizationId } = ctx.var;
  return db
    .update(attachmentsTable)
    .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
    .where(
      and(
        inArray(attachmentsTable.id, ids),
        eq(attachmentsTable.organizationId, organizationId),
        isNull(attachmentsTable.deletedAt),
      ),
    );
};

interface SoftDeleteAttachmentsByTaskIdsOpts {
  taskIds: string[];
  deletedBy: string;
  deletedAt: string;
}

/** Soft-delete attachments owned by the given tasks (host relation), reusing the tasks' deletion stamps. */
export const softDeleteAttachmentsByTaskIds = async (
  ctx: AuthContext,
  { taskIds, deletedAt, deletedBy }: SoftDeleteAttachmentsByTaskIdsOpts,
) => {
  const { db, organizationId } = ctx.var;
  return db
    .update(attachmentsTable)
    .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
    .where(
      and(
        inArray(attachmentsTable.taskId, taskIds),
        eq(attachmentsTable.organizationId, organizationId),
        isNull(attachmentsTable.deletedAt),
      ),
    );
};

interface FindAttachmentsByIdsOpts {
  ids: string[];
}

/**
 * Find live (non-deleted) attachments by id. Tenant-scoped via RLS from `tenantRead`:
 * unknown, deleted, and cross-tenant ids are simply absent from the result.
 */
export const findAttachmentsByIds = async (ctx: DbContext, { ids }: FindAttachmentsByIdsOpts) => {
  const { db } = ctx.var;
  return db
    .select()
    .from(attachmentsTable)
    .where(and(inArray(attachmentsTable.id, ids), isNull(attachmentsTable.deletedAt)));
};

interface FindAttachmentKeysByTaskIdOpts {
  taskId: string;
}

/** Find attachment IDs and S3 keys owned by a task (host relation, e.g. for description sync). */
export const findAttachmentKeysByTaskId = async (ctx: DbContext, { taskId }: FindAttachmentKeysByTaskIdOpts) => {
  const { db } = ctx.var;
  return db
    .select({
      id: attachmentsTable.id,
      keys: attachmentsTable.keys,
    })
    .from(attachmentsTable)
    .where(eq(attachmentsTable.taskId, taskId));
};

interface FindAttachmentViewCountOpts {
  entityId: string;
}

/** Find an attachment's view count from product counters. */
export const findAttachmentViewCount = async (ctx: DbContext, { entityId }: FindAttachmentViewCountOpts) => {
  const { db } = ctx.var;
  const [counters] = await db
    .select({ viewCount: productCountersTable.viewCount })
    .from(productCountersTable)
    .where(eq(productCountersTable.productId, entityId))
    .limit(1);
  return counters?.viewCount ?? 0;
};
