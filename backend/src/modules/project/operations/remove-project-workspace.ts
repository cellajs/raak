import type { AuthContext } from '#/core/context';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import {
  requireCurrentUserProjectMembership,
  setCurrentUserProjectMembershipWorkspace,
} from '#/modules/project/helpers/project-membership-workspace';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidContextEntity } from '#/permissions';
import { log } from '#/utils/logger';

export async function removeProjectWorkspaceOp(ctx: AuthContext, id: string) {
  const { entity: project } = await getValidContextEntity(ctx, id, 'project', 'read');
  const membership = requireCurrentUserProjectMembership(ctx, project);
  const updatedMembership = await setCurrentUserProjectMembershipWorkspace(ctx, {
    membership,
    workspaceId: null,
  });

  log.info('Project workspace removed', { projectId: project.id });

  const projectWithAudit = await withAuditUser(ctx, project);

  return { ...projectWithAudit, included: { membership: toMembershipBase(updatedMembership) } };
}
