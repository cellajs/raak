import type { UserContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { requireProjectMembership, setProjectMembershipWorkspace } from '#/modules/project/operations/project-workspace-membership';
import { getValidChannel } from '#/permissions';
import { log } from '#/utils/logger';

/**
 * Takes a project out of the caller's workspace; the caller keeps the project membership.
 * @throws The refusals of `getValidChannel` for `read`; 404 without a membership.
 */
export async function removeProjectWorkspaceOp(ctx: UserContext, id: string) {
  const { entity: project } = await getValidChannel(ctx, id, 'project', 'read');
  const membership = requireProjectMembership(ctx, project);
  const updatedMembership = await setProjectMembershipWorkspace(ctx, membership, null);

  log.info('Project workspace removed', { projectId: project.id });

  const projectWithAudit = await withActorRef(ctx, project);

  return { ...projectWithAudit, included: { membership: toMembershipBase(updatedMembership) } };
}
