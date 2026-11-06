import { inArray } from 'drizzle-orm';
import type { OrgContext } from '#/core/context';
import { baseDb, getSeedDb } from '#/db/db';
import { resolveEntity } from '#/modules/entities/entities-queries';
import { findMembershipsByUserIds } from '#/modules/memberships/memberships-queries';
import { withOrganizationDefaults } from '#/modules/organization/helpers/select';
import { provisionSample } from '#/modules/sample/operations/provision-sample';
import { insertSeenBy } from '#/modules/seen/seen-queries';
import { tasksTable } from '#/modules/task/task-db';
import { loadTenant } from '#/modules/tenants/load-tenant';
import { checkMark } from '#/utils/console';
import type { ShowcaseSeeded } from './showcase.seed';

const dbCtx = { var: { db: baseDb } };

/**
 * The sample projects in the organization the board shots open: the first one the admin administers and has not
 * archived, as `administeredOrganization` in `cella/screenshots.app.ts` picks it. The admin has read every sample task.
 */
export const seedAppShowcase = async ({ adminId, organizations }: ShowcaseSeeded) => {
  const shot = organizations.find(({ adminMembership }) => adminMembership?.role === 'admin' && !adminMembership.archived);
  if (!shot) return;
  const { id: organizationId, tenantId } = shot.channel;

  const [tenant, organization, bindings] = await Promise.all([
    loadTenant(tenantId),
    resolveEntity(dbCtx, { entityType: 'organization', identifier: organizationId }),
    findMembershipsByUserIds(dbCtx, { userIds: [adminId] }),
  ]);
  if (!tenant || !organization) throw new Error(`The showcase organization ${shot.org.name} is missing`);
  const membership = bindings.find((binding) => binding.channelType === 'organization' && binding.organizationId === organizationId) ?? null;

  const ctx: OrgContext = {
    var: {
      actor: { kind: 'user', id: adminId, bindings, scopes: null },
      isSystemAdmin: false,
      db: baseDb,
      tenantId,
      tenant,
      organizationId,
      organization: { ...withOrganizationDefaults(organization), membership },
    },
  };
  const { projects } = await provisionSample(ctx, { userId: adminId });

  const db = getSeedDb();
  const projectIds = projects.map(({ id }) => id);
  const tasks = await db.select({ id: tasksTable.id }).from(tasksTable).where(inArray(tasksTable.projectId, projectIds));
  // Unread, most cards would carry an unseen mark, and the light run of a shot would clear them for its dark twin
  const productIds = tasks.map(({ id }) => id);
  await db.transaction((tx) => insertSeenBy({ var: { db: tx } }, { userId: adminId, productType: 'task', productIds }));

  console.info(`${checkMark} Sample projects in ${organization.name}: ${projects.length} projects, ${tasks.length} tasks`);
};
