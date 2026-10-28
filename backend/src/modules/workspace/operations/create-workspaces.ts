import type { z } from '@hono/zod-openapi';
import type { UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { userActorRef, withActorRefs } from '#/modules/actors/actor-refs';
import { countTenantEntityRows } from '#/modules/entities/entities-queries';
import { buildZeroCounts } from '#/modules/entities/helpers/build-zero-counts';
import { generateUniqueSlugs } from '#/modules/entities/operations/generate-unique-slugs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { assertTenantQuota } from '#/modules/tenants/tenant-restrictions';
import { insertWorkspaces } from '#/modules/workspace/workspace-queries';
import { workspaceContract } from '#/modules/workspace/workspace-schema';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { log } from '#/utils/logger';
import { createRejectionState } from '#/utils/rejection-utils';

/**
 * Creates workspaces in the organization, each with its creator as admin and a slug derived from the creator and the
 * organization.
 * @throws AppError 403 `restrict_by_app` past the tenant's workspace quota.
 */
export async function createWorkspacesOp(ctx: UserContext, rawItems: z.infer<typeof workspaceContract.createItemSchema>[]) {
  const itemsToCreate = rawItems.map((item) => workspaceContract.normalizeBody(item));
  const { user, organization } = ctx.var;

  const currentWorkspaces = await countTenantEntityRows(ctx, { entityType: 'workspace' });
  assertTenantQuota(ctx, 'workspace', currentWorkspaces, itemsToCreate.length);

  canCreateEntity(ctx, buildSubject('workspace', { organizationId: organization.id }));

  const slugBase = `${user.slug}-${organization.slug}`;
  const slugs = await generateUniqueSlugs(
    ctx,
    itemsToCreate.map(() => slugBase),
    'workspace',
  );
  const workspaceValues = itemsToCreate.map((item, index) => ({
    name: item.name,
    slug: slugs[index],
    createdBy: user.id,
    tenantId: organization.tenantId,
    organizationId: organization.id,
  }));

  // A workspace and its creator's membership commit together: a workspace without its admin reaches no one
  const { workspaceRecords, createdMemberships } = await ctx.var.db.transaction(async (tx) => {
    const txCtx = { var: { db: tx } };
    const workspaceRecords = await insertWorkspaces(txCtx, { workspaces: workspaceValues });
    const membershipInserts = workspaceRecords.map((workspace) => ({
      userId: user.id,
      createdBy: user.id,
      role: 'admin' as const,
      entity: { ...workspace, tenantId: organization.tenantId },
    }));
    const createdMemberships = await insertMemberships(txCtx, { items: membershipInserts });
    return { workspaceRecords, createdMemberships };
  });

  log.info('Workspaces created', { count: workspaceRecords.length, ids: workspaceRecords.map((workspace) => workspace.id) });

  // The caller's next request reads the new memberships
  invalidateCache.user(user.id);

  const counts = buildZeroCounts('workspace', 'admin');
  const membershipByWsId = new Map(createdMemberships.map((membership) => [membership.workspaceId, membership]));
  const workspacesWithAudit = await withActorRefs(ctx, workspaceRecords, [userActorRef(user)]);

  const workspaceResponses = workspacesWithAudit.map((ws) => {
    const membership = membershipByWsId.get(ws.id)!;
    return { ...ws, included: { membership: toMembershipBase(membership), counts } };
  });

  return { data: workspaceResponses, ...createRejectionState() };
}
