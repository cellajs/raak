import { eq } from 'drizzle-orm';
import { baseDb } from '#/db/db';
import { organizationsTable } from '#/modules/organization/organization-db';
import type { SandboxModel } from '#/modules/sandbox/sandbox-db';
import { tenantsTable } from '#/modules/tenants/tenants-db';
import { deleteAccounts } from '#/modules/user/operations/delete-accounts';

/**
 * Removes a sandbox that was not kept: its organization with everything in it (stored files through the deletion
 * queue, as for a removed tenant), its tenant with the sandbox row, then its account and that account's sessions. No
 * operator mail: a sandbox held no customer's data.
 */
export async function removeSandbox({ tenantId, userId }: Pick<SandboxModel, 'tenantId' | 'userId'>) {
  await baseDb.transaction(async (tx) => {
    await tx.delete(organizationsTable).where(eq(organizationsTable.tenantId, tenantId));
    await tx.delete(tenantsTable).where(eq(tenantsTable.id, tenantId));
  });
  await deleteAccounts({ var: { db: baseDb } }, { userIds: [userId], by: userId });
}
