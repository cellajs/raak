import type { EntityRole } from 'shared';
import type { UserContext } from '#/core/context';
import { AppError } from '#/core/error';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { findProjectsPaginated } from '#/modules/project/project-queries';
import { coalesceAuditUsers } from '#/modules/user/helpers/audit-user';
import { actorFrom } from '#/permissions/access';
import { resolveChannelCollectionReadScope } from '#/permissions/channel-collection-scope';

interface GetProjectsInput {
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  workspaceId?: string;
  relatableUserId?: string;
  role?: EntityRole;
  excludeArchived?: boolean;
  scope?: 'memberships' | 'organization';
  include: string[];
}

export async function getProjectsOp(ctx: UserContext, input: GetProjectsInput) {
  const user = ctx.var.user;
  const memberships = ctx.var.memberships;
  const { include, relatableUserId, scope, ...queryParams } = input;

  // relatableGuard already verified shared org membership if relatableUserId is provided
  const targetUserId = relatableUserId ?? user.id;
  const ofAnotherUser = !!relatableUserId && relatableUserId !== user.id;
  // Another user's projects are listed only in organizations the caller is a member of too, where the policy lets
  // every member read every project; a system admin sees all of them.
  const sharedWithCaller = ofAnotherUser && !ctx.var.isSystemAdmin ? [...new Set(memberships.map((m) => m.organizationId))] : undefined;

  // The listed user's role, archive and workspace are theirs alone: as a filter on another user's list they are
  // refused, never dropped. The menu-order default names the caller's own menu, so another user's list comes by name.
  if (ofAnotherUser && (queryParams.role || queryParams.excludeArchived || queryParams.workspaceId)) {
    throw new AppError(403, 'forbidden', 'warn', { entityType: 'project', meta: { reason: 'other_user_membership' } });
  }

  // An organization's list is not a membership list: the membership filters and another user's list are refused, never dropped.
  const organizationWide = scope === 'organization';
  const { organizationId } = queryParams;
  if (organizationWide && (!organizationId || relatableUserId || queryParams.role || queryParams.excludeArchived || queryParams.workspaceId)) {
    throw new AppError(400, 'invalid_request', 'warn', { entityType: 'project', meta: { reason: 'organization_scope' } });
  }
  const readScope =
    organizationWide && organizationId ? resolveChannelCollectionReadScope(memberships, 'project', organizationId, actorFrom(ctx)) : undefined;

  const byName = (ofAnotherUser || organizationWide) && (!queryParams.sort || queryParams.sort === 'displayOrder');
  const sort = byName ? ('name' as const) : queryParams.sort;

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');

  const opts = { userId: targetUserId, ...queryParams, sort, organizationIds: sharedWithCaller, readScope, includeCounts };
  const { items: projectResults, total } = await findProjectsPaginated(ctx, opts);

  // Build response with included wrapper for optional data
  const items = coalesceAuditUsers(projectResults).map((row) => {
    const { membership: listedMembership, counts, ...project } = row;
    // The row joins the listed user's membership; the response carries the caller's own, or none
    const membership = ofAnotherUser ? memberships.find((m) => m.channelType === 'project' && m.projectId === project.id) : listedMembership;
    const included: { membership?: ReturnType<typeof toMembershipBase>; counts?: typeof counts } = {};
    if (includeMembership && membership) included.membership = toMembershipBase(membership);
    if (includeCounts && counts) included.counts = counts;
    return { ...project, included };
  });

  return { items, total };
}
