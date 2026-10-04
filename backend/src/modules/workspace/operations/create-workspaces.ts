import { nanoid } from 'shared/utils/nanoid';
import type { DbContext, UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { getOrganizationEntityCount } from '#/modules/entities/entities-queries';
import { buildZeroCounts } from '#/modules/entities/helpers/build-zero-counts';
import { checkSlugAvailable } from '#/modules/entities/operations/check-slug';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { withAuditUsers } from '#/modules/user/operations/with-audit-users';
import { insertWorkspaces } from '#/modules/workspace/workspace-queries';
import { workspaceContract } from '#/modules/workspace/workspace-schema';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { log } from '#/utils/logger';
import { createRejectionState, takeWithRestriction } from '#/utils/rejection-utils';

type CreateWorkspaceItem = { id: string; name: string };

/** `taken` holds the slugs given out earlier in the same request, which the database does not know yet. */
const generateUniqueSlug = async (ctx: DbContext, baseSlug: string, taken: Set<string>): Promise<string> => {
  if (!taken.has(baseSlug) && (await checkSlugAvailable(ctx, baseSlug, 'workspace'))) return baseSlug;

  const withSuffix = `${baseSlug}-${nanoid(6)}`;
  if (await checkSlugAvailable(ctx, withSuffix, 'workspace')) return withSuffix;

  // Final fallback uses enough entropy that collisions are not expected.
  return `${withSuffix}-${nanoid(10)}`;
};

export async function createWorkspacesOp(ctx: UserContext, rawItems: CreateWorkspaceItem[]) {
  // Lens seam: canonicalize old-shape field names before any body access
  const items = rawItems.map((item) => workspaceContract.normalizeBody(item));
  const db = ctx.var.db;
  const user = ctx.var.user;
  const organization = ctx.var.organization;

  const currentWorkspacesCount = await getOrganizationEntityCount(ctx, { organizationId: organization.id, entityType: 'workspace' });
  const workspaceRestrictions = ctx.var.tenant.restrictions.quotas.workspace;
  const availableSlots = workspaceRestrictions === 0 ? items.length : workspaceRestrictions - currentWorkspacesCount;

  const restrictionFiltered =
    workspaceRestrictions === 0 ? { items, rejectionState: createRejectionState() } : takeWithRestriction(items, availableSlots, 'restrict_by_org');

  const itemsToCreate = restrictionFiltered.items;
  const rejectionState = restrictionFiltered.rejectionState;

  if (itemsToCreate.length === 0) {
    return { data: [] as never[], ...rejectionState };
  }

  canCreateEntity(ctx, buildSubject('workspace', { organizationId: organization.id }));

  // One at a time: every item starts from the same base slug, and none of them is inserted yet.
  const takenSlugs = new Set<string>();
  const workspaceValues: Parameters<typeof insertWorkspaces>[1]['workspaces'] = [];
  for (const item of itemsToCreate) {
    const slug = await generateUniqueSlug(ctx, `${user.slug}-${organization.slug}`, takenSlugs);
    takenSlugs.add(slug);
    workspaceValues.push({ name: item.name, slug, createdBy: user.id, tenantId: organization.tenantId, organizationId: organization.id });
  }

  const workspaceRecords = await insertWorkspaces(ctx, { workspaces: workspaceValues });

  log.info('Workspaces created', { count: workspaceRecords.length, ids: workspaceRecords.map((ws) => ws.id) });

  const membershipInserts = workspaceRecords.map((ws) => ({
    userId: user.id,
    createdBy: user.id,
    role: 'admin' as const,
    entity: { ...ws, tenantId: organization.tenantId },
  }));

  const createdMemberships = await insertMemberships({ var: { db } }, { items: membershipInserts });

  // Invalidate membership cache so subsequent requests see the new membership
  invalidateCache.user(user.id);

  const counts = buildZeroCounts('workspace');
  const membershipByWsId = new Map(createdMemberships.map((m) => [m.workspaceId, m]));
  const workspacesWithAudit = await withAuditUsers(ctx, workspaceRecords, user);

  const workspaceResponses = workspacesWithAudit.map((ws) => {
    const membership = membershipByWsId.get(ws.id)!;
    return { ...ws, included: { membership: toMembershipBase(membership), counts } };
  });

  return { data: workspaceResponses, ...rejectionState };
}
