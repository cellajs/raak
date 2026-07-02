import type { AuthContext } from '#/core/context';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { coalesceAuditUsers } from '#/modules/user/helpers/audit-user';
import { getWorkspacesList } from '#/modules/workspace/workspace-queries';

interface GetWorkspacesInput {
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  role?: 'admin' | 'member' | 'guest';
  excludeArchived?: boolean;
  include: string[];
}

export async function getWorkspacesOp(ctx: AuthContext, input: GetWorkspacesInput) {
  const user = ctx.var.user;
  const { include, ...queryOpts } = input;

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');

  const { workspaces: workspaceResults, total } = await getWorkspacesList(ctx, {
    userId: user.id,
    ...queryOpts,
    includeCounts,
  });

  const items = coalesceAuditUsers(workspaceResults).map((ws) => {
    const { membership, counts, ...workspace } = ws;
    const included: { membership?: ReturnType<typeof toMembershipBase>; counts?: typeof counts } = {};
    if (includeMembership && membership) included.membership = toMembershipBase(membership);
    if (includeCounts && counts) included.counts = counts;
    return { ...workspace, included };
  });

  return { items, total };
}
