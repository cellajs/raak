import type { AuthContext, DbContext } from '#/core/context';
import { AppError } from '#/core/error';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import {
  deleteProjectMembership,
  findMaxDisplayOrder,
  insertProjectMembership,
} from '#/modules/project/project-queries';
import { getValidChannelEntity } from '#/permissions';

type ProjectMembershipTarget = {
  id: string;
  entityType: 'project';
};

type ProjectMembership = AuthContext['var']['memberships'][number] & {
  channelType: 'project';
  projectId: string;
};

type SetProjectMembershipWorkspaceInput = {
  membership: ProjectMembership;
  workspaceId: string | null;
  role?: ProjectMembership['role'];
};

type ReplaceProjectMembershipWorkspaceInput = SetProjectMembershipWorkspaceInput & {
  createdBy: string;
};

type UpsertProjectMembershipWorkspaceInput = {
  project: ProjectMembershipTarget;
  workspaceId: string | null;
};

function isProjectMembershipTarget(
  membership: AuthContext['var']['memberships'][number],
  project: ProjectMembershipTarget,
): membership is ProjectMembership {
  return membership.projectId === project.id && membership.channelType === project.entityType;
}

export async function resolveProjectWorkspaceId(ctx: AuthContext, workspaceId: string): Promise<string> {
  const { entity } = await getValidChannelEntity(ctx, workspaceId, 'workspace', 'read');
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

/** Replace a project membership with a new workspace assignment. */
export async function replaceProjectMembershipWorkspace(
  ctx: DbContext,
  { membership, workspaceId, createdBy, role }: ReplaceProjectMembershipWorkspaceInput,
) {
  const { db } = ctx.var;

  return db.transaction(async (tx) => {
    const txCtx: DbContext = { var: { db: tx } };
    const maxOrder = workspaceId
      ? await findMaxDisplayOrder(txCtx, {
          userId: membership.userId,
          channelType: membership.channelType,
          workspaceId,
        })
      : null;

    const displayOrder = workspaceId ? (maxOrder ? maxOrder + 1 : 1) : membership.displayOrder;

    await deleteProjectMembership(txCtx, {
      membershipId: membership.id,
      userId: membership.userId,
      channelId: membership.channelId,
      projectId: membership.projectId,
    });

    return insertProjectMembership(txCtx, {
      values: {
        tenantId: membership.tenantId,
        userId: membership.userId,
        channelType: membership.channelType,
        channelId: membership.channelId,
        organizationId: membership.organizationId,
        workspaceId,
        projectId: membership.projectId,
        role: role ?? membership.role,
        archived: membership.archived,
        muted: membership.muted,
        displayOrder,
        createdBy,
      },
    });
  });
}

export async function setCurrentUserProjectMembershipWorkspace(
  ctx: AuthContext,
  { membership, workspaceId, role }: SetProjectMembershipWorkspaceInput,
) {
  const updatedMembership = await replaceProjectMembershipWorkspace(ctx, {
    membership,
    workspaceId,
    createdBy: ctx.var.user.id,
    role,
  });

  invalidateCache.user(updatedMembership.userId);

  return updatedMembership;
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
    userId: user.id,
    channelType: project.entityType,
    workspaceId,
  });

  const membership = await insertProjectMembership(ctx, {
    values: {
      tenantId: organization.tenantId,
      userId: user.id,
      channelType: project.entityType,
      channelId: project.id,
      organizationId: organization.id,
      workspaceId,
      projectId: project.id,
      role: organization.membership?.role ?? 'member',
      createdBy: user.id,
      displayOrder: maxOrder ? maxOrder + 1 : 1,
    },
  });

  invalidateCache.user(membership.userId);

  return membership;
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
    membership: existingMembership,
    workspaceId,
    role:
      existingMembership.role === 'guest'
        ? (ctx.var.organization.membership?.role ?? 'member')
        : existingMembership.role,
  });
}
