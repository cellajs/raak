import { type EntityRole, hierarchy } from 'shared';
import type { UserContext } from '#/core/context';
import { withActorRefs } from '#/modules/actors/actor-refs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { findMemberPreviewsByChannels } from '#/modules/memberships/memberships-queries';
import type { UserMinimalBase } from '#/modules/user/helpers/user-minimal';
import { findWorkspacesPaginated } from '#/modules/workspace/workspace-queries';

interface GetWorkspacesInput {
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  role?: EntityRole;
  excludeArchived?: boolean;
  include: string[];
}

export async function getWorkspacesOp(ctx: UserContext, input: GetWorkspacesInput) {
  const user = ctx.var.user;
  const { include, ...queryOpts } = input;

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');
  const includeMembers = include.includes('members');

  const { items: workspaceResults, total } = await findWorkspacesPaginated(ctx, { userId: user.id, ...queryOpts, includeCounts });

  const memberPreviews = includeMembers
    ? await findMemberPreviewsByChannels(ctx, {
        channelType: 'workspace',
        channelIds: workspaceResults.map((ws) => ws.id),
        role: hierarchy.getRoles('workspace')[0],
        limit: 3,
      })
    : null;

  const items = (await withActorRefs(ctx, workspaceResults)).map((ws) => {
    const { membership, counts, ...workspace } = ws;
    const included: { membership?: ReturnType<typeof toMembershipBase>; counts?: typeof counts; members?: UserMinimalBase[] } = {};
    if (includeMembership && membership) included.membership = toMembershipBase(membership);
    if (includeCounts && counts) included.counts = counts;
    if (memberPreviews) included.members = memberPreviews.get(ws.id) ?? [];
    return { ...workspace, included };
  });

  return { items, total };
}
