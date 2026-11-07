import { and, count, eq, gte, lt, or, sql } from 'drizzle-orm';
import type { DbContext } from '#/core/context';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { sandboxesTable } from '#/modules/sandbox/sandbox-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';

export const insertSandbox = async (ctx: DbContext, { values }: { values: typeof sandboxesTable.$inferInsert }) => {
  const [sandbox] = await ctx.var.db.insert(sandboxesTable).values(values).returning();
  return sandbox;
};

/** The sandbox of a sandbox account: the one it took, or the one it joined. */
export const findSandboxByUser = async (ctx: DbContext, { userId }: { userId: string }) => {
  const [sandbox] = await ctx.var.db
    .select()
    .from(sandboxesTable)
    .where(or(eq(sandboxesTable.userId, userId), sql`${userId}::uuid = any(${sandboxesTable.guestIds})`))
    .limit(1);
  return sandbox;
};

export const findSandboxByShareCode = async (ctx: DbContext, { shareCode }: { shareCode: string }) => {
  const [sandbox] = await ctx.var.db.select().from(sandboxesTable).where(eq(sandboxesTable.shareCode, shareCode)).limit(1);
  return sandbox;
};

/** Holds a place for `userId` among the sandbox's guests; undefined once `cap` people are in it. */
export const addSandboxGuest = async (ctx: DbContext, { id, userId, cap }: { id: string; userId: string; cap: number }) => {
  const [sandbox] = await ctx.var.db
    .update(sandboxesTable)
    .set({ guestIds: sql`array_append(${sandboxesTable.guestIds}, ${userId}::uuid)` })
    .where(and(eq(sandboxesTable.id, id), sql`cardinality(${sandboxesTable.guestIds}) < ${cap - 1}`))
    .returning();
  return sandbox;
};

export const removeSandboxGuest = async (ctx: DbContext, { id, userId }: { id: string; userId: string }) =>
  ctx.var.db
    .update(sandboxesTable)
    .set({ guestIds: sql`array_remove(${sandboxesTable.guestIds}, ${userId}::uuid)` })
    .where(eq(sandboxesTable.id, id));

export const findExpiredSandboxes = async (ctx: DbContext, { now }: { now: string }) =>
  ctx.var.db.select().from(sandboxesTable).where(lt(sandboxesTable.expiresAt, now));

export const countClaimsSince = async (ctx: DbContext, { since }: { since: string }) => {
  const [{ total }] = await ctx.var.db.select({ total: count() }).from(sandboxesTable).where(gte(sandboxesTable.createdAt, since));
  return total;
};

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

export const findOrganizationProjects = async (ctx: DbContext, { organizationId }: { organizationId: string }) =>
  ctx.var.db.select().from(projectsTable).where(eq(projectsTable.organizationId, organizationId));

/**
 * How many rows of a public count are demo boards': their people, their organizations, and the workspaces and
 * projects in them. The about page's counters show customers, which a demo board is not.
 */
export const countSandboxRows = async (ctx: DbContext, { entityType }: { entityType: string }): Promise<number> => {
  const { db } = ctx.var;
  if (entityType === 'user') {
    const [{ total }] = await db
      .select({ total: sql<number>`coalesce(sum(1 + cardinality(${sandboxesTable.guestIds})), 0)::int` })
      .from(sandboxesTable);
    return total;
  }
  if (entityType === 'organization') {
    const [{ total }] = await db.select({ total: count() }).from(sandboxesTable);
    return total;
  }
  const table = entityType === 'workspace' ? workspacesTable : entityType === 'project' ? projectsTable : null;
  if (!table) return 0;
  const [{ total }] = await db.select({ total: count() }).from(table).innerJoin(sandboxesTable, eq(sandboxesTable.tenantId, table.tenantId));
  return total;
};
