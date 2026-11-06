import { index, snakeCase, uuid, varchar } from 'drizzle-orm/pg-core';
import { generateId } from 'shared/utils/entity-id';
import { tenantIdLength } from '#/db/utils/constraints';
import { isoTimestamp } from '#/db/utils/timestamp-columns';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { usersTable } from '#/modules/user/user-db';

export const sandboxStatuses = ['ready', 'claimed'] as const;

/**
 * A sandbox: a throwaway account with a tenant and a draft organization holding the sample. The pool keeps some
 * `ready`; a visitor's claim makes one `claimed` until `expiresAt`, when it is removed.
 */
export const sandboxesTable = snakeCase.table(
  'sandboxes',
  {
    id: uuid().primaryKey().$defaultFn(generateId),
    tenantId: varchar({ length: tenantIdLength })
      .notNull()
      .references(() => tenantsTable.id, { onDelete: 'cascade' }),
    organizationId: uuid().notNull(),
    userId: uuid()
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    /** The dataset the sample came from: the pool rebuilds a ready sandbox of another. */
    contentVersion: varchar({ length: 64 }).notNull(),
    status: varchar({ enum: sandboxStatuses }).notNull().default('ready'),
    createdAt: isoTimestamp().defaultNow().notNull(),
    claimedAt: isoTimestamp(),
    expiresAt: isoTimestamp(),
  },
  (table) => [index('sandboxes_status_created_at_index').on(table.status, table.createdAt), index('sandboxes_user_id_index').on(table.userId)],
);

export type SandboxModel = typeof sandboxesTable.$inferSelect;
