import type { AuthContext } from '#/core/context';
import {
  requireCurrentUserProjectMembership,
  resolveProjectWorkspaceId,
  setCurrentUserProjectMembershipWorkspace,
} from '#/modules/project/helpers/project-membership-workspace';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidContextEntity } from '#/permissions';
import { logEvent } from '#/utils/logger';

export async function moveProjectToWorkspaceOp(ctx: AuthContext, id: string, workspaceId: string) {
  const { entity: project } = await getValidContextEntity(ctx, id, 'project', 'read');
  const resolvedWorkspaceId = await resolveProjectWorkspaceId(ctx, workspaceId);
  const membership = requireCurrentUserProjectMembership(ctx, project);
  const updatedMembership = await setCurrentUserProjectMembershipWorkspace(ctx, {
    membershipId: membership.id,
    workspaceId: resolvedWorkspaceId,
  });

  logEvent(ctx, 'info', 'Project workspace moved', { projectId: project.id, workspaceId: resolvedWorkspaceId });

  const projectWithAudit = await withAuditUser(ctx, project);

  return { ...projectWithAudit, included: { membership: updatedMembership } };
}
