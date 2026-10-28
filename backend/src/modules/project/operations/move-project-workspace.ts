import type { UserContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import {
  requireCurrentUserProjectMembership,
  resolveProjectWorkspaceId,
  setCurrentUserProjectMembershipWorkspace,
} from '#/modules/project/operations/project-workspace-membership';
import { getValidChannel } from '#/permissions';
import { log } from '#/utils/logger';

/**
 * Moves the caller's project membership to another of their workspaces, at the end of its order.
 * @throws The refusals of `getValidChannel` for `read`; 404 without a membership; 409 `workspace_in_other_organization`.
 */
export async function moveProjectToWorkspaceOp(ctx: UserContext, id: string, workspaceId: string) {
  const { entity: project } = await getValidChannel(ctx, id, 'project', 'read');
  const resolvedWorkspaceId = await resolveProjectWorkspaceId(ctx, workspaceId);
  const membership = requireCurrentUserProjectMembership(ctx, project);
  const updatedMembership = await setCurrentUserProjectMembershipWorkspace(ctx, { membership, workspaceId: resolvedWorkspaceId });

  log.info('Project workspace moved', { projectId: project.id, workspaceId: resolvedWorkspaceId });

  const projectWithAudit = await withActorRef(ctx, project);

  return { ...projectWithAudit, included: { membership: toMembershipBase(updatedMembership) } };
}
