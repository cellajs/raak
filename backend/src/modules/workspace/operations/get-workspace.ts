import type { ActorContext } from '#/core/context';
import { getChannelCounts } from '#/modules/entities/entities-queries';
import { isMembershipRow, toMembershipBase } from '#/modules/memberships/helpers/select';
import { withAuditUser } from '#/modules/user/operations/with-audit-users';
import { getValidChannel } from '#/permissions/get-valid-channel';

interface GetWorkspaceOpts {
  bySlug?: boolean;
  include: string[];
}

export async function getWorkspaceOp(ctx: ActorContext, id: string, opts: GetWorkspaceOpts) {
  const { bySlug, include } = opts;

  const { entity: workspace, membership } = await getValidChannel(ctx, id, 'workspace', 'read', bySlug);

  const includeCounts = include.includes('counts');
  const includeMembership = include.includes('membership');

  const [counts, workspaceWithAudit] = await Promise.all([
    includeCounts ? getChannelCounts(ctx, { entityType: 'workspace', entityId: workspace.id }) : undefined,
    withAuditUser(ctx, workspace),
  ]);

  const included: { counts?: typeof counts; membership?: ReturnType<typeof toMembershipBase> } = {};
  if (counts) included.counts = counts;
  if (includeMembership && membership && isMembershipRow(membership)) included.membership = toMembershipBase(membership);

  return { ...workspaceWithAudit, included };
}
