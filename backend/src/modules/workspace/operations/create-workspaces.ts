import type { AuthContext } from '#/core/context';
import { buildZeroCounts } from '#/modules/entities/helpers/build-zero-counts';
import { generateUniqueSlug } from '#/modules/entities/helpers/generate-slug';
import { getOrgEntityCount } from '#/modules/entities/helpers/get-entity-counts';
import { insertMemberships } from '#/modules/memberships/helpers/membership-helpers';
import { withAuditUsers } from '#/modules/user/helpers/audit-user';
import { insertWorkspaces } from '#/modules/workspace/workspace-queries';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { logEvent } from '#/utils/logger';
import { createRejectionState, takeWithRestriction } from '#/utils/rejection-utils';

type CreateWorkspaceItem = { id: string; name: string };

export async function createWorkspacesOp(ctx: AuthContext, items: CreateWorkspaceItem[]) {
  const db = ctx.var.db;
  const user = ctx.var.user;
  const organization = ctx.var.organization;

  const currentWorkspacesCount = await getOrgEntityCount(ctx, organization.id, 'workspace');
  const workspaceRestrictions = ctx.var.tenant.restrictions.quotas.workspace;
  const availableSlots = workspaceRestrictions === 0 ? items.length : workspaceRestrictions - currentWorkspacesCount;

  const restrictionFiltered =
    workspaceRestrictions === 0
      ? { items, rejectionState: createRejectionState() }
      : takeWithRestriction(items, availableSlots, 'restrict_by_org');

  const itemsToCreate = restrictionFiltered.items;
  const rejectionState = restrictionFiltered.rejectionState;

  if (itemsToCreate.length === 0) {
    return { data: [] as never[], ...rejectionState };
  }

  canCreateEntity(ctx, buildSubject('workspace', { organizationId: organization.id }));

  const workspaceValues = await Promise.all(
    itemsToCreate.map(async (item) => ({
      name: item.name,
      slug: await generateUniqueSlug(ctx, `${user.slug}-${organization.slug}`, 'workspace'),
      createdBy: user.id,
      tenantId: organization.tenantId,
      organizationId: organization.id,
    })),
  );

  const workspaceRecords = await insertWorkspaces(ctx, { workspaces: workspaceValues });

  logEvent(ctx, 'info', 'Workspaces created', {
    count: workspaceRecords.length,
    ids: workspaceRecords.map((ws) => ws.id),
  });

  const membershipInserts = workspaceRecords.map((ws) => ({
    userId: user.id,
    createdBy: user.id,
    role: 'admin' as const,
    entity: { ...ws, tenantId: organization.tenantId },
  }));

  const createdMemberships = await insertMemberships({ var: { db } }, { items: membershipInserts, logCtx: ctx });

  const counts = buildZeroCounts('workspace');
  const membershipByWsId = new Map(createdMemberships.map((m) => [m.workspaceId, m]));
  const workspacesWithAudit = await withAuditUsers(ctx, workspaceRecords, user);

  const workspaceResponses = workspacesWithAudit.map((ws) => {
    const membership = membershipByWsId.get(ws.id)!;
    return { ...ws, included: { membership, counts } };
  });

  return { data: workspaceResponses, ...rejectionState };
}
