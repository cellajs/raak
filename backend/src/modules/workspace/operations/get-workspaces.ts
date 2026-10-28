import type { z } from '@hono/zod-openapi';
import { hierarchy } from 'shared';
import type { UserContext } from '#/core/context';
import { withActorRefs } from '#/modules/actors/actor-refs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { findMemberPreviewsByChannels } from '#/modules/memberships/memberships-queries';
import type { UserMinimalBase } from '#/modules/user/helpers/user-minimal';
import { findWorkspacesPaginated } from '#/modules/workspace/workspace-queries';
import type { workspaceListQuerySchema } from '#/modules/workspace/workspace-schema';

/** A page of the workspaces the caller is a member of; for a system admin, archived tenants' workspaces too. */
export async function getWorkspacesOp(ctx: UserContext, input: z.infer<typeof workspaceListQuerySchema>) {
  const user = ctx.var.user;
  const { include, ...queryOpts } = input;

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');
  const includeMembers = include.includes('members');

  const { items: workspaceResults, total } = await findWorkspacesPaginated(ctx, {
    userId: user.id,
    isSystemAdmin: ctx.var.isSystemAdmin,
    ...queryOpts,
    includeCounts,
  });

  const memberPreviews = includeMembers
    ? await findMemberPreviewsByChannels(ctx, {
        channelType: 'workspace',
        channelIds: workspaceResults.map((workspace) => workspace.id),
        role: hierarchy.getMostPrivilegedRole('workspace'),
        limit: 3,
      })
    : null;

  const items = (await withActorRefs(ctx, workspaceResults)).map((row) => {
    const { membership, counts, ...workspace } = row;
    const included: { membership?: ReturnType<typeof toMembershipBase>; counts?: typeof counts; members?: UserMinimalBase[] } = {};
    if (includeMembership && membership) included.membership = toMembershipBase(membership);
    if (includeCounts && counts) included.counts = counts;
    if (memberPreviews) included.members = memberPreviews.get(workspace.id) ?? [];
    return { ...workspace, included };
  });

  return { items, total };
}
