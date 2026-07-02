import type { AuthContext } from '#/core/context';
import { getProjectsList } from '#/modules/project/project-queries';
import { coalesceAuditUsers } from '#/modules/user/helpers/audit-user';

interface GetProjectsInput {
  q?: string;
  sort?: 'id' | 'name' | 'createdAt' | 'displayOrder';
  order?: 'asc' | 'desc';
  offset: number;
  limit: number;
  organizationId?: string;
  workspaceId?: string;
  relatableUserId?: string;
  role?: 'admin' | 'member' | 'guest';
  excludeArchived?: boolean;
  include: string[];
}

export async function getProjectsOp(ctx: AuthContext, input: GetProjectsInput) {
  const user = ctx.var.user;
  const { include, relatableUserId, ...queryParams } = input;

  // relatableGuard already verified shared org membership if relatableUserId is provided
  const targetUserId = relatableUserId ?? user.id;

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');

  const { projects: projectResults, total } = await getProjectsList(ctx, {
    userId: targetUserId,
    ...queryParams,
    includeCounts,
  });

  // Build response with included wrapper for optional data
  const items = coalesceAuditUsers(projectResults).map((row) => {
    const { membership, counts, ...project } = row;
    const included: { membership?: typeof membership; counts?: typeof counts } = {};
    if (includeMembership && membership) included.membership = membership;
    if (includeCounts && counts) included.counts = counts;
    return { ...project, included };
  });

  return { items, total };
}
