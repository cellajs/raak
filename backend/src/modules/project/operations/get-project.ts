import type { AuthContext } from '#/core/context';
import { getEntityCounts } from '#/modules/entities/helpers/get-entity-counts';
import { getTaskStatusCounts } from '#/modules/task/helpers/get-task-status-counts';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidContextEntity } from '#/permissions';

export async function getProjectOp(ctx: AuthContext, id: string, opts: { bySlug?: boolean; include: string[] }) {
  const user = ctx.var.user;
  const { bySlug, include } = opts;

  const { entity: project, membership } = await getValidContextEntity(ctx, id, 'project', 'read', bySlug);

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');

  const [counts, taskStatusCounts, projectWithAudit] = await Promise.all([
    includeCounts ? getEntityCounts(ctx, 'project', project.id) : undefined,
    includeCounts ? getTaskStatusCounts(ctx, project.id) : undefined,
    withAuditUser(ctx, project, user),
  ]);

  const included: {
    counts?: typeof counts & { taskStatusCounts: typeof taskStatusCounts };
    membership?: NonNullable<typeof membership>;
  } = {};

  if (counts) included.counts = { ...counts, taskStatusCounts };

  if (includeMembership && membership) {
    included.membership = membership;
  }

  return { ...projectWithAudit, included };
}
