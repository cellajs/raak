import { defaultOrder, orderGap } from 'shared/utils/display-order';
import type { DbContext, UserContext } from '#/core/context';
import { AppError } from '#/core/error';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { insertMembershipRows } from '#/modules/memberships/memberships-queries';
import { deleteProjectMembership, findMaxDisplayOrder } from '#/modules/project/project-queries';
import { getValidChannel } from '#/permissions';

type ProjectMembership = UserContext['var']['memberships'][number] & { channelType: 'project'; projectId: string };

/**
 * The id of a workspace the caller may read; `getValidChannel` limits it to the request's organization.
 * @throws The refusals of `getValidChannel` for `read`.
 */
export async function resolveProjectWorkspaceId(ctx: UserContext, workspaceId: string): Promise<string> {
  const { entity } = await getValidChannel(ctx, workspaceId, 'workspace', 'read');
  return entity.id;
}

/**
 * The caller's membership of the project.
 * @throws AppError 404 `not_found` when the caller holds none.
 */
export function requireProjectMembership(ctx: UserContext, project: { id: string }) {
  const membership = ctx.var.memberships.find(
    (candidate): candidate is ProjectMembership => candidate.channelType === 'project' && candidate.projectId === project.id,
  );

  if (!membership) {
    throw new AppError(404, 'not_found', 'warn', { entityType: 'project', meta: { membership: 'current_user', projectId: project.id } });
  }

  return membership;
}

/**
 * Files the caller's project membership under a workspace, at the end of the caller's order there, or with a null
 * `workspaceId` takes it out of its workspace. The membership keeps its role.
 */
export async function setProjectMembershipWorkspace(ctx: UserContext, membership: ProjectMembership, workspaceId: string | null) {
  const updatedMembership = await ctx.var.db.transaction(async (tx) => {
    const txCtx: DbContext = { var: { db: tx } };
    const maxOrder = workspaceId
      ? await findMaxDisplayOrder(txCtx, { userId: membership.userId, channelType: membership.channelType, workspaceId })
      : null;

    const displayOrder = workspaceId ? (maxOrder === null ? defaultOrder : maxOrder + orderGap) : membership.displayOrder;

    await deleteProjectMembership(txCtx, { membershipId: membership.id, userId: membership.userId });

    const [insertedMembership] = await insertMembershipRows(txCtx, {
      values: [
        {
          tenantId: membership.tenantId,
          userId: membership.userId,
          channelType: membership.channelType,
          channelId: membership.channelId,
          organizationId: membership.organizationId,
          workspaceId,
          projectId: membership.projectId,
          role: membership.role,
          archived: membership.archived,
          muted: membership.muted,
          displayOrder,
          createdBy: ctx.var.user.id,
        },
      ],
    });
    return insertedMembership;
  });

  invalidateCache.user(updatedMembership.userId);

  return updatedMembership;
}
