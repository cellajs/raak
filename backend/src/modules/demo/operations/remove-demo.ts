import { inArray } from 'drizzle-orm';
import { baseDb } from '#/db/db';
import type { DemoModel } from '#/modules/demo/demo-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { deleteAccounts } from '#/modules/user/operations/delete-accounts';

/**
 * Removes a demo: its organization with everything in it (stored files through the deletion queue, as for a removed
 * tenant), its tenant with the demo row, any tenant its people made with that tenant's organization, then their
 * accounts and sessions. No operator mail: a demo held no customer's data.
 */
export async function removeDemo({ tenantId, userId, guestIds = [] }: Pick<DemoModel, 'tenantId' | 'userId'> & { guestIds?: string[] }) {
  const userIds = [userId, ...guestIds];
  await baseDb.transaction(async (tx) => {
    const made = await tx.select({ id: tenantsTable.id }).from(tenantsTable).where(inArray(tenantsTable.createdBy, userIds));
    const tenantIds = [tenantId, ...made.map(({ id }) => id)];
    await tx.delete(organizationsTable).where(inArray(organizationsTable.tenantId, tenantIds));
    await tx.delete(tenantsTable).where(inArray(tenantsTable.id, tenantIds));
  });
  await deleteAccounts({ var: { db: baseDb } }, { userIds, by: userId });
}
