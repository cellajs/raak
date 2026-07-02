import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import {
  findMaxDisplayOrder,
  insertProjectMembership,
  updateMembershipWorkspace,
} from '#/modules/project/project-queries';
import { getValidContextEntity } from '#/permissions';
import { getIsoDate } from '#/utils/iso-date';

type ProjectMembershipTarget = {
  id: string;
  entityType: 'project';
};

type SetProjectMembershipWorkspaceInput = {
  membershipId: string;
  workspaceId: string | null;
  role?: string;
};

type UpsertProjectMembershipWorkspaceInput = {
  project: ProjectMembershipTarget;
  workspaceId: string | null;
};

function isProjectMembershipTarget(
  membership: AuthContext['var']['memberships'][number],
  project: ProjectMembershipTarget,
) {
  return membership.projectId === project.id && membership.contextType === project.entityType;
}

export async function resolveProjectWorkspaceId(ctx: AuthContext, workspaceId: string): Promise<string> {
  const { entity } = await getValidContextEntity(ctx, workspaceId, 'workspace', 'read');
  return entity.id;
}

export function findCurrentUserProjectMembership(ctx: AuthContext, project: ProjectMembershipTarget) {
  return ctx.var.memberships.find((membership) => isProjectMembershipTarget(membership, project));
}

export function requireCurrentUserProjectMembership(ctx: AuthContext, project: ProjectMembershipTarget) {
  const membership = findCurrentUserProjectMembership(ctx, project);

  if (!membership) {
    throw new AppError(404, 'not_found', 'warn', {
      entityType: project.entityType,
      meta: { membership: 'current_user', projectId: project.id },
    });
  }

  return membership;
}

export async function setCurrentUserProjectMembershipWorkspace(
  ctx: AuthContext,
  { membershipId, workspaceId, role }: SetProjectMembershipWorkspaceInput,
) {
  return updateMembershipWorkspace(ctx, {
    membershipId,
    workspaceId,
    updatedBy: ctx.var.user.id,
    updatedAt: getIsoDate(),
    role,
  });
}

async function createCurrentUserProjectMembershipInWorkspace(
  ctx: AuthContext,
  {
    project,
    workspaceId,
  }: {
    project: ProjectMembershipTarget;
    workspaceId: string;
  },
) {
  const { user, organization } = ctx.var;

  const maxOrder = await findMaxDisplayOrder(ctx, {
    contextType: project.entityType,
    workspaceId,
  });

  return insertProjectMembership(ctx, {
    values: {
      tenantId: organization.tenantId,
      userId: user.id,
      contextType: project.entityType,
      contextId: project.id,
      organizationId: organization.id,
      workspaceId,
      projectId: project.id,
      role: organization.membership?.role ?? 'member',
      createdBy: user.id,
      displayOrder: maxOrder ? maxOrder + 1 : 1,
    },
  });
}

export async function upsertCurrentUserProjectMembershipWorkspace(
  ctx: AuthContext,
  { project, workspaceId }: UpsertProjectMembershipWorkspaceInput,
) {
  const existingMembership = findCurrentUserProjectMembership(ctx, project);

  if (!existingMembership) {
    if (workspaceId) {
      return createCurrentUserProjectMembershipInWorkspace(ctx, { project, workspaceId });
    }

    throw new AppError(400, 'invalid_request', 'warn', {
      message: 'Project membership not found for workspace removal.',
    });
  }

  return setCurrentUserProjectMembershipWorkspace(ctx, {
    membershipId: existingMembership.id,
    workspaceId,
    role:
      existingMembership.role === 'guest'
        ? (ctx.var.organization.membership?.role ?? 'member')
        : existingMembership.role,
  });
}
