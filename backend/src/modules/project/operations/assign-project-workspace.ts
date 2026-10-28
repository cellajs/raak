import type { UserContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { resolveProjectWorkspaceId, upsertCurrentUserProjectMembershipWorkspace } from '#/modules/project/operations/project-workspace-membership';
import { getValidChannel } from '#/permissions';
import { log } from '#/utils/logger';

/**
 * Files a project the caller may read under one of their workspaces, creating the caller's project membership when they
 * hold none.
 * @throws The refusals of `getValidChannel` for `read`; 409 `workspace_in_other_organization`.
 */
export async function assignProjectWorkspaceOp(ctx: UserContext, id: string, workspaceId: string) {
  const { entity: project } = await getValidChannel(ctx, id, 'project', 'read');
  const resolvedWorkspaceId = await resolveProjectWorkspaceId(ctx, workspaceId);
  const updatedMembership = await upsertCurrentUserProjectMembershipWorkspace(ctx, { project, workspaceId: resolvedWorkspaceId });

  log.info('Project workspace assigned', { projectId: project.id, workspaceId: resolvedWorkspaceId });

  const projectWithAudit = await withActorRef(ctx, project);

  return { ...projectWithAudit, included: { membership: toMembershipBase(updatedMembership) } };
}
