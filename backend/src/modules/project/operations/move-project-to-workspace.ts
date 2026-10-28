import type { UserContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import {
  requireProjectMembership,
  resolveProjectWorkspaceId,
  setProjectMembershipWorkspace,
} from '#/modules/project/operations/project-workspace-membership';
import { getValidChannel } from '#/permissions';
import { log } from '#/utils/logger';

/**
 * Moves the caller's project membership to another of their workspaces, at the end of its order.
 * @throws The refusals of `getValidChannel` for `read`; 404 without a membership.
 */
export async function moveProjectToWorkspaceOp(ctx: UserContext, id: string, workspaceId: string) {
  const { entity: project } = await getValidChannel(ctx, id, 'project', 'read');
  const resolvedWorkspaceId = await resolveProjectWorkspaceId(ctx, workspaceId);
  const membership = requireProjectMembership(ctx, project);
  const updatedMembership = await setProjectMembershipWorkspace(ctx, membership, resolvedWorkspaceId);

  log.info('Project workspace moved', { projectId: project.id, workspaceId: resolvedWorkspaceId });

  const projectWithAudit = await withActorRef(ctx, project);

  return { ...projectWithAudit, included: { membership: toMembershipBase(updatedMembership) } };
}
