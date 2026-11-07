import { sql } from 'drizzle-orm';
import { index, snakeCase, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { generateId } from 'shared/utils/entity-id';
import { tenantIdLength } from '#/db/utils/constraints';
import { isoTimestamp } from '#/db/utils/timestamp-columns';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { usersTable } from '#/modules/user/user-db';

/**
 * A demo board, a sandbox in code: a throwaway account with a tenant and a draft organization holding the sample,
 * built at a visitor's claim and removed at `expiresAt` with the guests who joined it.
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
    shareCode: varchar({ length: 16 }).notNull().default(sql`substr(md5(gen_random_uuid()::text), 1, 16)`),
    /** Colleagues who joined through the link, each on a sandbox account of their own. */
    guestIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: isoTimestamp().defaultNow().notNull(),
    expiresAt: isoTimestamp().notNull(),
  },
  (table) => [
    index('sandboxes_created_at_index').on(table.createdAt),
    index('sandboxes_expires_at_index').on(table.expiresAt),
    index('sandboxes_user_id_index').on(table.userId),
    uniqueIndex('sandboxes_share_code_index').on(table.shareCode),
  ],
);

export type SandboxModel = typeof sandboxesTable.$inferSelect;
