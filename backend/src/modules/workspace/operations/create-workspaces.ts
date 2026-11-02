import type { z } from '@hono/zod-openapi';
import { hierarchy } from 'shared';
import type { UserContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { userActorRef, withActorRefs } from '#/modules/actors/actor-refs';
import { countTenantEntityRows } from '#/modules/entities/entities-queries';
import { buildZeroCounts } from '#/modules/entities/helpers/build-zero-counts';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { assertTenantQuota } from '#/modules/tenants/tenant-restrictions';
import { insertHeldWorkspaces } from '#/modules/workspace/operations/ensure-workspace';
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
  const creatorRole = hierarchy.getMostPrivilegedRole('workspace');

  const currentWorkspaces = await countTenantEntityRows(ctx, { entityType: 'workspace' });
  assertTenantQuota(ctx, 'workspace', currentWorkspaces, itemsToCreate.length);

  canCreateEntity(ctx, buildSubject('workspace', { organizationId: organization.id }));

  const names = itemsToCreate.map((item) => item.name);
  const { workspaceRecords, createdMemberships } = await ctx.var.db.transaction((tx) =>
    insertHeldWorkspaces({ var: { db: tx } }, { holder: user, organization, names }),
  );

  log.info('Workspaces created', { count: workspaceRecords.length, ids: workspaceRecords.map((workspace) => workspace.id) });

  // The caller's next request reads the new memberships
  invalidateCache.user(user.id);

  const counts = buildZeroCounts('workspace', creatorRole);
  const membershipByWorkspaceId = new Map(createdMemberships.map((membership) => [membership.workspaceId, membership]));
  const workspacesWithAudit = await withActorRefs(ctx, workspaceRecords, [userActorRef(user)]);

  const workspaceResponses = workspacesWithAudit.map((workspace) => {
    const membership = membershipByWorkspaceId.get(workspace.id)!;
    return { ...workspace, included: { membership: toMembershipBase(membership), counts } };
  });

  return { data: workspaceResponses, ...createRejectionState() };
}
