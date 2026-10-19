import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
// biome-ignore lint/style/noRestrictedImports: colocated membership mutations with optimistic cache updates for project settings actions.
import { removeProjectWorkspace } from 'sdk';
import { toaster } from '~/modules/common/toaster/toaster';
import { useLeaveChannel } from '~/modules/memberships/leave-channel-button';
import { getApiIncludedMembership, upsertMyMembershipCache } from '~/modules/memberships/query-mutations';
import { projectQueryKeys } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { queryClient } from '~/query/query-client';

interface UseProjectMembershipActionsArgs {
  isInWorkspace: boolean;
  project: EnrichedProject;
  tenantId: string;
  onSuccess?: () => void;
}

export function useProjectMembershipActions({ isInWorkspace, project, tenantId, onSuccess }: UseProjectMembershipActionsArgs) {
  const { t } = useTranslation();
  const projectMembership = project.membership;

  const projectHasWorkspace = Boolean(projectMembership?.workspaceId);

  const { leave: leaveProject, isPending: isLeavingProject } = useLeaveChannel(project, {
    redirectPath: isInWorkspace ? null : '/home',
    callback: onSuccess,
  });

  const { mutate: removeProjectFromWorkspace, isPending: isRemovingProjectFromWorkspace } = useMutation({
    mutationFn: async () => {
      const workspaceId = projectMembership?.workspaceId;
      if (!workspaceId) throw new Error('Project has no workspace membership to remove.');
      return await removeProjectWorkspace({ path: { id: project.id, organizationId: project.organizationId, tenantId } });
    },
    onSuccess: (updatedProject) => {
      toaster.success(t('c:success.project_disconnected'));
      onSuccess?.();

      const membership = getApiIncludedMembership(updatedProject);
      if (membership) upsertMyMembershipCache(membership);
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.list.base, refetchType: 'active' });
    },
  });

  return { isLeavingProject, isRemovingProjectFromWorkspace, leaveProject, projectHasWorkspace, removeProjectFromWorkspace };
}
