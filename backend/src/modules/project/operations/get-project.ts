import type { AuthContext } from '#/core/context';
import { getEntityCounts } from '#/modules/entities/helpers/get-entity-counts';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { getTaskStatusCounts } from '#/modules/task/helpers/get-task-status-counts';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidChannelEntity } from '#/permissions';

export async function getProjectOp(ctx: AuthContext, id: string, opts: { bySlug?: boolean; include: string[] }) {
  const user = ctx.var.user;
  const { bySlug, include } = opts;

  const { entity: project, membership } = await getValidChannelEntity(ctx, id, 'project', 'read', bySlug);

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');

  const [counts, taskStatusCounts, projectWithAudit] = await Promise.all([
    includeCounts ? getEntityCounts(ctx, 'project', project.id) : undefined,
    includeCounts ? getTaskStatusCounts(ctx, project.id) : undefined,
    withAuditUser(ctx, project, user),
  ]);

  const included: {
    counts?: typeof counts & { taskStatusCounts: typeof taskStatusCounts };
    membership?: ReturnType<typeof toMembershipBase>;
  } = {};

  if (counts) included.counts = { ...counts, taskStatusCounts };

  if (includeMembership && membership) {
    included.membership = toMembershipBase(membership);
  }

  return { ...projectWithAudit, included };
}
