import { unsafeInternalAdminDb } from '#/db/db';
import { activityBus, getEventData } from '#/lib/activity-bus';
import { updateMembershipWorkspace } from '#/modules/project/project-queries';
import { findLatestUserWorkspaceId } from '#/modules/workspace/workspace-queries';
import { getIsoDate } from '#/utils/iso-date';
import { logEvent } from '#/utils/logger';

/**
 * Activity bus listeners for project-related side effects.
 *
 * Backfills `memberships.workspaceId` on newly created project memberships
 * when the user already has a workspace membership in the same organization.
 *
 * The project creator already gets `workspaceId` set inline by `createProjectsOp`.
 * This listener covers all other paths (invitation accept, direct add, system
 * admin self-add) without modifying entity-agnostic cella code.
 *
 * If the user has no workspace in the org, the row is left as-is and the
 * frontend handles the unassigned state.
 */
activityBus.on('membership.created', async (event) => {
  const membership = getEventData(event, 'membership');
  if (!membership) return;
  if (membership.contextType !== 'project') return;
  if (!membership.projectId || !membership.organizationId || !membership.userId) return;
  if (membership.workspaceId) return;
  if (membership.role === 'guest') return;

  const adminCtx = { var: { db: unsafeInternalAdminDb! } };

  try {
    const workspaceId = await findLatestUserWorkspaceId(adminCtx, {
      userId: membership.userId,
      organizationId: membership.organizationId,
    });
    if (!workspaceId) return;

    await updateMembershipWorkspace(adminCtx, {
      membershipId: membership.id,
      workspaceId,
      updatedBy: membership.userId,
      updatedAt: getIsoDate(),
    });
  } catch (error) {
    logEvent(null, 'error', 'Failed to backfill workspaceId on project membership', {
      error,
      membershipId: membership.id,
    });
  }
});
