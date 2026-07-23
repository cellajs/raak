import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
// biome-ignore lint/style/noRestrictedImports: colocated membership mutations with optimistic cache updates for project settings actions.
import { deleteMyMembership, type MembershipBase, removeProjectWorkspace } from 'sdk';
import { toaster } from '~/modules/common/toaster/toaster';
import { meKeys } from '~/modules/me/query';
import { getApiIncludedMembership, upsertMyMembershipCache } from '~/modules/memberships/query-mutations';
import { projectQueryKeys } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { cacheRemove } from '~/query/basic/cache-mutations';
import { queryClient } from '~/query/query-client';

const removeMembershipFromCache = (predicate: (membership: MembershipBase) => boolean) => {
  queryClient.setQueryData<{ items: MembershipBase[] }>(meKeys.memberships, (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      items: oldData.items.filter((membership) => !predicate(membership)),
    };
  });
};

interface UseProjectMembershipActionsArgs {
  boardType?: string | null;
  project: EnrichedProject;
  tenantId: string;
  onSuccess?: () => void;
}

export function useProjectMembershipActions({
  boardType,
  project,
  tenantId,
  onSuccess,
}: UseProjectMembershipActionsArgs) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projectMembership = project.membership;
  const projectListKey = projectQueryKeys.list.base;

  const projectHasWorkspace = Boolean(projectMembership?.workspaceId);

  const { mutate: leaveProject, isPending: isLeavingProject } = useMutation({
    mutationFn: async () => {
      const entityId = project.id;
      return await deleteMyMembership({ query: { entityId, entityType: 'project' } });
    },
    onSuccess: () => {
      toaster.success(t('c:success.you_left_entity', { entity: t('c:project').toLowerCase() }));
      onSuccess?.();

      removeMembershipFromCache(
        (membership) => membership.channelType === 'project' && membership.channelId === project.id,
      );

      navigate({ to: boardType === 'workspace' ? '.' : '/home', replace: true });

      cacheRemove(projectListKey, [project]);
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail.base });
    },
  });

  const { mutate: removeProjectFromWorkspace, isPending: isRemovingProjectFromWorkspace } = useMutation({
    mutationFn: async () => {
      const workspaceId = projectMembership?.workspaceId;
      if (!workspaceId) throw new Error('Project has no workspace membership to remove.');
      return await removeProjectWorkspace({
        path: { id: project.id, organizationId: project.organizationId, tenantId },
      });
    },
    onSuccess: (updatedProject) => {
      toaster.success(t('c:success.project_disconnected'));
      onSuccess?.();

      const membership = getApiIncludedMembership(updatedProject);
      if (membership) upsertMyMembershipCache(membership);
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.list.base, refetchType: 'active' });
    },
  });

  return {
    isLeavingProject,
    isRemovingProjectFromWorkspace,
    leaveProject,
    projectHasWorkspace,
    removeProjectFromWorkspace,
  };
}
