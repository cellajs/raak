import { appConfig } from 'shared';
import { generateId } from 'shared/utils/entity-id';
import { nanoid } from 'shared/utils/nanoid';
import { baseDb } from '#/db/db';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { insertOrganizations } from '#/modules/organization/organization-queries';
import { provisionSample } from '#/modules/sample/operations/provision-sample';
import { memberContext } from '#/modules/sandbox/operations/member-context';
import { removeSandbox } from '#/modules/sandbox/operations/remove-sandbox';
import { sandboxAddressDomain, sandboxContentVersion } from '#/modules/sandbox/sandbox-constants';
import { insertSandbox } from '#/modules/sandbox/sandbox-queries';
import { insertTenant } from '#/modules/tenants/tenants-queries';
import { insertUsers } from '#/modules/user/user-queries';
import { ensureUserWorkspace } from '#/modules/workspace/operations/ensure-workspace';
import { log } from '#/utils/logger';
import { defaultWelcomeText } from '#json/text-blocks.json';

const dbCtx = { var: { db: baseDb } };

/**
 * Builds a ready sandbox: a provisional account under a reserved address with no email row, its own tenant with a draft
 * organization it administers (a draft, so its invitations never go out), its workspace, and the sample.
 * Creates no tenant notice: nobody asked for an organization yet. A failed build removes what it wrote.
 */
export async function buildSandbox() {
  const userId = generateId();
  const handle = nanoid(10);

  const [user] = await insertUsers(dbCtx, {
    users: [
      {
        id: userId,
        name: 'Guest',
        firstName: 'Guest',
        slug: `guest-${handle}`,
        email: `${userId}@${sandboxAddressDomain}`,
        language: appConfig.defaultLanguage,
        userFlags: { finishedOnboarding: true },
      },
    ],
  });
  const tenant = await insertTenant(dbCtx, { values: { name: 'Sandbox', createdBy: userId } });

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
