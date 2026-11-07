import { appConfig } from 'shared';
import { generateId } from 'shared/utils/entity-id';
import { nanoid } from 'shared/utils/nanoid';
import { baseDb } from '#/db/db';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { insertOrganizations } from '#/modules/organization/organization-queries';
import { provisionSample } from '#/modules/sample/operations/provision-sample';
import { memberContext } from '#/modules/sandbox/operations/member-context';
import { removeSandbox } from '#/modules/sandbox/operations/remove-sandbox';
import { insertSandboxAccount } from '#/modules/sandbox/operations/sandbox-account';
import { sandboxContentVersion } from '#/modules/sandbox/sandbox-constants';
import { insertSandbox } from '#/modules/sandbox/sandbox-queries';
import { defaultRestrictions } from '#/modules/tenants/tenant-restrictions';
import { insertTenant } from '#/modules/tenants/tenants-queries';
import { ensureUserWorkspace } from '#/modules/workspace/operations/ensure-workspace';
import { log } from '#/utils/logger';
import { defaultWelcomeText } from '#json/text-blocks.json';

const dbCtx = { var: { db: baseDb } };

/**
 * Builds a ready sandbox: a provisional account, its own tenant with a draft organization it administers (a draft, so
 * its invitations never go out), its workspace, and the sample.
 * Creates no tenant notice: nobody asked for an organization yet. A failed build removes what it wrote.
 */
export async function buildSandbox() {
  const userId = generateId();
  const handle = nanoid(10);

  const user = await insertSandboxAccount({ id: userId, handle });
  // One seat, taken from the start: an invitation from a sandbox is refused before it mails anyone. Its people come in
  // through the share link, which seats them directly.
  const restrictions = defaultRestrictions();
  const tenant = await insertTenant(dbCtx, {
    values: { name: 'Sandbox', createdBy: userId, restrictions: { ...restrictions, quotas: { ...restrictions.quotas, user: 1 } } },
  });

  try {
    const [organization] = await insertOrganizations(dbCtx, {
      orgs: [
        {
          name: 'Your sandbox',
          shortName: 'Sandbox',
          slug: `sandbox-${handle}`,
          tenantId: tenant.id,
          languages: [appConfig.defaultLanguage],
          welcomeText: defaultWelcomeText,
          defaultLanguage: appConfig.defaultLanguage,
          createdBy: userId,
          publishedAt: null,
        },
      ],
    });
    await insertMemberships(dbCtx, { items: [{ userId, createdBy: userId, role: 'admin', entity: organization }] });
    const workspaceId = await ensureUserWorkspace(dbCtx, { userId, organizationId: organization.id });

    await provisionSample(await memberContext(user, organization), { userId, workspaceId });

    const sandbox = await insertSandbox(dbCtx, {
      values: { tenantId: tenant.id, organizationId: organization.id, userId, contentVersion: sandboxContentVersion },
    });
    log.info('Sandbox built', { sandboxId: sandbox.id, tenantId: tenant.id });
    return sandbox;
  } catch (error) {
    await removeSandbox({ tenantId: tenant.id, userId });
    throw error;
  }
}
