import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { findMembershipsByUserIds } from '#/modules/memberships/memberships-queries';
import { withOrganizationDefaults } from '#/modules/organization/helpers/select';
import type { OrganizationModel } from '#/modules/organization/organization-db';
import { loadTenant } from '#/modules/tenants/load-tenant';
import type { UserModel } from '#/modules/user/user-db';
import type { YjsMaterializerContext } from '#/modules/yjs/yjs-materializers';

/**
 * What the guards give a request of `user` in `organization`, for work on the user's behalf that runs without one: the
 * pool's builds. No system-administrator bypass.
 * @throws AppError 404 when the organization's tenant is gone.
 */
export const memberContext = async (user: UserModel, organization: OrganizationModel): Promise<YjsMaterializerContext> => {
  const [tenant, bindings] = await Promise.all([
    loadTenant(organization.tenantId),
    findMembershipsByUserIds({ var: { db: baseDb } }, { userIds: [user.id] }),
  ]);
  if (!tenant) throw new AppError(404, 'not_found', 'warn', { entityType: 'organization', meta: { tenantId: organization.tenantId } });
  const membership = bindings.find((binding) => binding.organizationId === organization.id && binding.channelType === 'organization') ?? null;

  return {
    var: {
      user,
      actor: { kind: 'user', id: user.id, bindings, scopes: null },
      isSystemAdmin: false,
      db: baseDb,
      tenantId: tenant.id,
      tenant,
      organizationId: organization.id,
      organization: { ...withOrganizationDefaults(organization), membership },
    },
  };
};
