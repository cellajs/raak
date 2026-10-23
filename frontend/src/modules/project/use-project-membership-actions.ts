import { useTranslation } from 'react-i18next';
import { toaster } from '~/modules/common/toaster/toaster';
import { useLeaveChannel } from '~/modules/memberships/use-leave-channel';
import { useProjectRemoveWorkspaceMutation } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';

interface UseProjectMembershipActionsArgs {
  isInWorkspace: boolean;
  project: EnrichedProject;
  onSuccess?: () => void;
}

export function useProjectMembershipActions({ isInWorkspace, project, onSuccess }: UseProjectMembershipActionsArgs) {
  const { t } = useTranslation();

  const projectHasWorkspace = Boolean(project.membership?.workspaceId);

  const { leave: leaveProject, isPending: isLeavingProject } = useLeaveChannel(project, {
    redirectPath: isInWorkspace ? null : '/home',
    callback: onSuccess,
  });

  const { mutate: removeWorkspace, isPending: isRemovingProjectFromWorkspace } = useProjectRemoveWorkspaceMutation();

  const removeProjectFromWorkspace = () =>
    removeWorkspace(
      { path: { id: project.id, organizationId: project.organizationId, tenantId: project.tenantId } },
      {
        onSuccess: () => {
          toaster.success(t('c:success.project_disconnected'));
          onSuccess?.();
        },
      },
    );

  return { isLeavingProject, isRemovingProjectFromWorkspace, leaveProject, projectHasWorkspace, removeProjectFromWorkspace };
}
