import { and, count, eq, gte, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { DbContext } from '#/core/context';
import { updateStamps } from '#/db/utils/stamps';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { type SandboxModel, sandboxesTable } from '#/modules/sandbox/sandbox-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { getIsoDate } from '#/utils/iso-date';

export const insertSandbox = async (ctx: DbContext, { values }: { values: typeof sandboxesTable.$inferInsert }) => {
  const [sandbox] = await ctx.var.db.insert(sandboxesTable).values(values).returning();
  return sandbox;
};

/** Claims the oldest ready sandbox of `contentVersion`; two claims at once never get the same one. */
export const claimReadySandbox = async (
  ctx: DbContext,
  { contentVersion, claimedAt, expiresAt }: { contentVersion: string; claimedAt: string; expiresAt: string },
): Promise<SandboxModel | undefined> => {
  const [claimed] = await ctx.var.db
    .update(sandboxesTable)
    .set({ status: 'claimed', claimedAt, expiresAt })
    .where(
      eq(
        sandboxesTable.id,
        sql`(select ${sandboxesTable.id} from ${sandboxesTable} where ${sandboxesTable.status} = 'ready' and ${sandboxesTable.contentVersion} = ${contentVersion} order by ${sandboxesTable.createdAt} limit 1 for update skip locked)`,
      ),
    )
    .returning();
  return claimed;
};

/** Claims the ready sandbox `id`, built for this claim; undefined when another claim took it first. */
export const claimSandbox = async (ctx: DbContext, { id, claimedAt, expiresAt }: { id: string; claimedAt: string; expiresAt: string }) => {
  const [claimed] = await ctx.var.db
    .update(sandboxesTable)
    .set({ status: 'claimed', claimedAt, expiresAt })
    .where(and(eq(sandboxesTable.id, id), eq(sandboxesTable.status, 'ready')))
    .returning();
  return claimed;
};

export const findSandboxByUser = async (ctx: DbContext, { userId }: { userId: string }) => {
  const [sandbox] = await ctx.var.db.select().from(sandboxesTable).where(eq(sandboxesTable.userId, userId)).limit(1);
  return sandbox;
};

export const countReadySandboxes = async (ctx: DbContext, { contentVersion }: { contentVersion: string }) => {
  const [{ total }] = await ctx.var.db
    .select({ total: count() })
    .from(sandboxesTable)
    .where(and(eq(sandboxesTable.status, 'ready'), eq(sandboxesTable.contentVersion, contentVersion)));
  return total;
};

/** Ready sandboxes of another dataset, or built before `createdBefore`. */
export const findStaleReadySandboxes = async (ctx: DbContext, { contentVersion, createdBefore }: { contentVersion: string; createdBefore: string }) =>
  ctx.var.db
    .select()
    .from(sandboxesTable)
    .where(
      and(eq(sandboxesTable.status, 'ready'), or(ne(sandboxesTable.contentVersion, contentVersion), lt(sandboxesTable.createdAt, createdBefore))),
    );

export const findExpiredSandboxes = async (ctx: DbContext, { now }: { now: string }) =>
  ctx.var.db
    .select()
    .from(sandboxesTable)
    .where(and(eq(sandboxesTable.status, 'claimed'), lt(sandboxesTable.expiresAt, now)));

export const countClaimsSince = async (ctx: DbContext, { since }: { since: string }) => {
  const [{ total }] = await ctx.var.db.select({ total: count() }).from(sandboxesTable).where(gte(sandboxesTable.claimedAt, since));
  return total;
};

export const markSandboxKept = async (ctx: DbContext, { id }: { id: string }) =>
  ctx.var.db.update(sandboxesTable).set({ status: 'kept', expiresAt: null }).where(eq(sandboxesTable.id, id));

/** Where a sandbox opens: its organization's slug and the slug of its account's workspace there. */
export const findSandboxPlace = async (ctx: DbContext, { userId, organizationId }: { userId: string; organizationId: string }) => {
  const [place] = await ctx.var.db
    .select({ organizationSlug: organizationsTable.slug, workspaceSlug: workspacesTable.slug })
    .from(membershipsTable)
    .innerJoin(workspacesTable, eq(workspacesTable.id, membershipsTable.channelId))
    .innerJoin(organizationsTable, eq(organizationsTable.id, membershipsTable.organizationId))
    .where(
      and(eq(membershipsTable.userId, userId), eq(membershipsTable.organizationId, organizationId), eq(membershipsTable.channelType, 'workspace')),
    )
    .orderBy(membershipsTable.displayOrder)
    .limit(1);
  return place;
};

export const findSandboxOrganization = async (ctx: DbContext, { id }: { id: string }) => {
  const [organization] = await ctx.var.db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  return organization;
};

export const renameSandboxOrganization = async (ctx: DbContext, { id, name, by }: { id: string; name: string; by: string }) =>
  ctx.var.db
    .update(organizationsTable)
    .set({ name, shortName: name, ...updateStamps(by) })
    .where(eq(organizationsTable.id, id));

/** Publishes a sandbox's draft organization; undefined when it was published already. */
export const publishSandboxOrganization = async (ctx: DbContext, { id, by }: { id: string; by: string }) => {
  const at = getIsoDate();
  const [published] = await ctx.var.db
    .update(organizationsTable)
    .set({ publishedAt: at, ...updateStamps(by, at) })
    .where(and(eq(organizationsTable.id, id), isNull(organizationsTable.publishedAt)))
    .returning();
  return published;
};
