import type { UserContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import {
  requireCurrentUserProjectMembership,
  setCurrentUserProjectMembershipWorkspace,
} from '#/modules/project/operations/project-workspace-membership';
import { getValidChannel } from '#/permissions';
import { log } from '#/utils/logger';

export async function removeProjectWorkspaceOp(ctx: UserContext, id: string) {
  const { entity: project } = await getValidChannel(ctx, id, 'project', 'read');
  const membership = requireCurrentUserProjectMembership(ctx, project);
  const updatedMembership = await setCurrentUserProjectMembershipWorkspace(ctx, { membership, workspaceId: null });

  log.info('Project workspace removed', { projectId: project.id });

  const projectWithAudit = await withActorRef(ctx, project);

  return { ...projectWithAudit, included: { membership: toMembershipBase(updatedMembership) } };
}
