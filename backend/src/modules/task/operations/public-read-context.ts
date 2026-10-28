import type { ActorContext } from '#/core/context';
import type { DbOrTx } from '#/db/db';

/**
 * The context of a public read's relation queries: the admin pool, scoped to the row's own tenant and organization,
 * since those queries are request-scoped. Cast: a public read has no actor, and those queries read only the connection
 * and the scope (`requestScope` types its context as `ActorContext`).
 */
export const publicReadContext = (db: DbOrTx, { tenantId, organizationId }: { tenantId: string; organizationId: string }) =>
  ({ var: { db, tenantId, organizationId } }) as ActorContext;
