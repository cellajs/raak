import type { AuthContext } from '#/core/context';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import {
  requireCurrentUserProjectMembership,
  resolveProjectWorkspaceId,
  setCurrentUserProjectMembershipWorkspace,
} from '#/modules/project/helpers/project-membership-workspace';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidContextEntity } from '#/permissions';
import { log } from '#/utils/logger';

export async function moveProjectToWorkspaceOp(ctx: AuthContext, id: string, workspaceId: string) {
  const { entity: project } = await getValidContextEntity(ctx, id, 'project', 'read');
  const resolvedWorkspaceId = await resolveProjectWorkspaceId(ctx, workspaceId);
  const membership = requireCurrentUserProjectMembership(ctx, project);
  const updatedMembership = await setCurrentUserProjectMembershipWorkspace(ctx, {
    membership,
    workspaceId: resolvedWorkspaceId,
  });

  log.info(ctx, 'Project workspace moved', { projectId: project.id, workspaceId: resolvedWorkspaceId });

  const projectWithAudit = await withAuditUser(ctx, project);

  return { ...projectWithAudit, included: { membership: toMembershipBase(updatedMembership) } };
}
