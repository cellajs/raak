import type { AuthContext } from '#/core/context';
import { getEntityCounts } from '#/modules/entities/helpers/get-entity-counts';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidContextEntity } from '#/permissions/get-context-entity';

interface GetWorkspaceOpts {
  bySlug?: boolean;
  include: string[];
}

export async function getWorkspaceOp(ctx: AuthContext, id: string, opts: GetWorkspaceOpts) {
  const user = ctx.var.user;
  const { bySlug, include } = opts;

  const { entity: workspace, membership } = await getValidContextEntity(ctx, id, 'workspace', 'read', bySlug);

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');

  const [counts, workspaceWithAudit] = await Promise.all([
    includeCounts ? getEntityCounts(ctx, 'workspace', workspace.id) : undefined,
    withAuditUser(ctx, workspace, user),
  ]);

  const included: { counts?: typeof counts; membership?: NonNullable<typeof membership> } = {};
  if (counts) included.counts = counts;
  if (includeMembership && membership) included.membership = membership;

  return { ...workspaceWithAudit, included };
}
