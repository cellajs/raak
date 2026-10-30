import { and, desc, eq, gt, isNull, type SQL, sql } from 'drizzle-orm';
import type { UserContext } from '#/core/context';
import { tenantRead } from '#/db/tenant-context';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { seenByTable } from '#/modules/seen/seen-by-db';
import { seenWindowStart } from '#/modules/seen/seen-queries';
import { tasksTable } from '#/modules/task/task-db';
import { actorFrom } from '#/permissions/access';
import { resolveCollectionReadFilter } from '#/permissions/collection-scope';
import { buildCollectionReadWhere } from '#/permissions/row-predicates';

/** Bounds the payload: the board marks the newest ones, the menu badge keeps the exact count. */
const unseenTaskIdsLimit = 200;

/**
 * The newest tasks that are new to the user, for the board's unseen mark. The filters mirror `findUnseenCountsByUser`,
 * plus a floor at the user's join date: a new member is not shown the project's whole past as news.
 */
export async function getUnseenTaskIdsOp(ctx: UserContext) {
  const user = ctx.var.user;
  const organization = ctx.var.organization;
  const actor = actorFrom(ctx);

  const readFilter = resolveCollectionReadFilter(ctx.var.memberships, 'task', organization.id, actor);
  const scopeWhere = buildCollectionReadWhere(readFilter, tasksTable, 'task', actor);
  if (scopeWhere.kind === 'none') return { items: [] };

  const joinedAt = (channelId: SQL | string) =>
    sql`(SELECT ${membershipsTable.createdAt} FROM ${membershipsTable} WHERE ${membershipsTable.userId} = ${user.id} AND ${membershipsTable.channelId} = ${channelId})`;

  // GREATEST skips nulls: a system admin without either membership falls back to the seen window alone.
  const floor = sql`GREATEST(${seenWindowStart()}::timestamptz, COALESCE(${joinedAt(sql`${tasksTable.projectId}`)}, ${joinedAt(organization.id)}))`;

  const items = await tenantRead(ctx, async (readCtx) => {
    const rows = await readCtx.var.db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.organizationId, organization.id),
          gt(tasksTable.createdAt, floor),
          sql`NOT EXISTS (SELECT 1 FROM ${seenByTable} WHERE ${seenByTable.userId} = ${user.id} AND ${seenByTable.productId} = ${tasksTable.id})`,
          isNull(tasksTable.deletedAt),
          scopeWhere.kind === 'where' ? scopeWhere.where : undefined,
        ),
      )
      .orderBy(desc(tasksTable.createdAt))
      .limit(unseenTaskIdsLimit);
    return rows.map(({ id }) => id);
  });

  return { items };
}
