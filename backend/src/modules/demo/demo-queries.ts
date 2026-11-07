import { and, count, eq, gte, lt, or, sql } from 'drizzle-orm';
import type { DbContext } from '#/core/context';
import { demosTable } from '#/modules/demo/demo-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';

export const insertDemo = async (ctx: DbContext, { values }: { values: typeof demosTable.$inferInsert }) => {
  const [demo] = await ctx.var.db.insert(demosTable).values(values).returning();
  return demo;
};

/** The demo of a demo account: the one it took, or the one it joined. */
export const findDemoByUser = async (ctx: DbContext, { userId }: { userId: string }) => {
  const [demo] = await ctx.var.db
    .select()
    .from(demosTable)
    .where(or(eq(demosTable.userId, userId), sql`${userId}::uuid = any(${demosTable.guestIds})`))
    .limit(1);
  return demo;
};

export const findDemoByShareCode = async (ctx: DbContext, { shareCode }: { shareCode: string }) => {
  const [demo] = await ctx.var.db.select().from(demosTable).where(eq(demosTable.shareCode, shareCode)).limit(1);
  return demo;
};

/** Holds a place for `userId` among the demo's guests; undefined once `cap` people are in it. */
export const addDemoGuest = async (ctx: DbContext, { id, userId, cap }: { id: string; userId: string; cap: number }) => {
  const [demo] = await ctx.var.db
    .update(demosTable)
    .set({ guestIds: sql`array_append(${demosTable.guestIds}, ${userId}::uuid)` })
    .where(and(eq(demosTable.id, id), sql`cardinality(${demosTable.guestIds}) < ${cap - 1}`))
    .returning();
  return demo;
};

export const removeDemoGuest = async (ctx: DbContext, { id, userId }: { id: string; userId: string }) =>
  ctx.var.db
    .update(demosTable)
    .set({ guestIds: sql`array_remove(${demosTable.guestIds}, ${userId}::uuid)` })
    .where(eq(demosTable.id, id));

export const findExpiredDemos = async (ctx: DbContext, { now }: { now: string }) =>
  ctx.var.db.select().from(demosTable).where(lt(demosTable.expiresAt, now));

export const countClaimsSince = async (ctx: DbContext, { since }: { since: string }) => {
  const [{ total }] = await ctx.var.db.select({ total: count() }).from(demosTable).where(gte(demosTable.createdAt, since));
  return total;
};

/** Where a demo opens: its organization's slug and the slug of its account's workspace there. */
export const findDemoPlace = async (ctx: DbContext, { userId, organizationId }: { userId: string; organizationId: string }) => {
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

export const findOrganizationProjects = async (ctx: DbContext, { organizationId }: { organizationId: string }) =>
  ctx.var.db.select().from(projectsTable).where(eq(projectsTable.organizationId, organizationId));

/**
 * How many rows of a public count are demo boards': their people, their organizations, and the workspaces and
 * projects in them. The about page's counters show customers, which a demo board is not.
 */
export const countDemoRows = async (ctx: DbContext, { entityType }: { entityType: string }): Promise<number> => {
  const { db } = ctx.var;
  if (entityType === 'user') {
    const [{ total }] = await db.select({ total: sql<number>`coalesce(sum(1 + cardinality(${demosTable.guestIds})), 0)::int` }).from(demosTable);
    return total;
  }
  if (entityType === 'organization') {
    const [{ total }] = await db.select({ total: count() }).from(demosTable);
    return total;
  }
  const table = entityType === 'workspace' ? workspacesTable : entityType === 'project' ? projectsTable : null;
  if (!table) return 0;
  const [{ total }] = await db.select({ total: count() }).from(table).innerJoin(demosTable, eq(demosTable.tenantId, table.tenantId));
  return total;
};
