import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
// biome-ignore lint/style/noRestrictedImports: colocated mutations — panel-scoped membership/workspace actions with combined optimistic cache logic.
import { deleteMyMembership, type MembershipBase, removeProjectWorkspace } from 'sdk';
import type { TriggerRef } from '~/modules/common/dialoger/use-dialoger';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { toaster } from '~/modules/common/toaster/toaster';
import { meKeys } from '~/modules/me/query';
import { projectQueryKeys } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Button } from '~/modules/ui/button';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { cacheRemove } from '~/query/basic/cache-mutations';
import { queryClient } from '~/query/query-client';

const REMOVE_PROJECT_ACTIONS_DIALOG_ID = 'remove-project-actions';

const removeMembershipFromCache = (predicate: (membership: MembershipBase) => boolean) => {
  queryClient.setQueryData<{ items: MembershipBase[] }>(meKeys.memberships, (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      items: oldData.items.filter((membership) => !predicate(membership)),
    };
  });
};

const updateMembershipInCache = (
  predicate: (membership: MembershipBase) => boolean,
  updater: (membership: MembershipBase) => MembershipBase,
) => {
  queryClient.setQueryData<{ items: MembershipBase[] }>(meKeys.memberships, (oldData) => {
    if (!oldData) return oldData;
    return {
      ...oldData,
      items: oldData.items.map((membership) => (predicate(membership) ? updater(membership) : membership)),
    };
  });
};

interface UseProjectMembershipActionsArgs {
  boardType: string;
  project: EnrichedProject;
  tenantId: string;
  projectButtonRef: TriggerRef;
}

export function useProjectMembershipActions({
  boardType,
  project,
  tenantId,
  projectButtonRef,
}: UseProjectMembershipActionsArgs) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projectMembership = project.membership;
  const projectListKey = projectQueryKeys.list.base;

  const projectHasWorkspace = Boolean(projectMembership?.workspaceId);
  const projectWorkspace = projectMembership?.workspaceId
    ? findWorkspaceByIdOrSlug(projectMembership.workspaceId, tenantId)
    : undefined;

  const { mutate: leaveProject, isPending: isLeavingProject } = useMutation({
    mutationFn: async () => {
      const entityId = project.id;
      return await deleteMyMembership({ query: { entityId, entityType: 'project' } });
    },
    onSuccess: () => {
      toaster(t('c:success.you_left_entity', { entity: t('c:project').toLowerCase() }), 'success');
      useDialoger.getState().remove(REMOVE_PROJECT_ACTIONS_DIALOG_ID);

      removeMembershipFromCache(
        (membership) => membership.contextType === 'project' && membership.contextId === project.id,
      );

      // Navigate to current workspace if inside it, otherwise home
      navigate({ to: boardType === 'workspace' ? '.' : '/home', replace: true });

      // Remove project from list cache and clean up detail queries
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
    onSuccess: () => {
      toaster('Project removed from workspace.', 'success');
      useDialoger.getState().remove(REMOVE_PROJECT_ACTIONS_DIALOG_ID);

      updateMembershipInCache(
        (membership) => membership.contextType === 'project' && membership.contextId === project.id,
        (membership) => ({ ...membership, workspaceId: null }),
      );
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.list.base, refetchType: 'active' });
    },
  });

  const openRemoveDialog = () => {
    useDialoger.getState().create(
      <div className="flex flex-col gap-2">
        <Button
          variant="destructive"
          className="w-full"
          soft
          onClick={() => removeProjectFromWorkspace()}
          disabled={!projectHasWorkspace}
        >
          {isRemovingProjectFromWorkspace ? t('c:loading') : 'Remove project from workspace'}
        </Button>
        <Button variant="destructive" className="w-full" onClick={() => leaveProject()}>
          {isLeavingProject ? t('c:loading') : 'Leave project'}
        </Button>
      </div>,
      {
        id: REMOVE_PROJECT_ACTIONS_DIALOG_ID,
        triggerRef: projectButtonRef,
        title: `${t('c:remove')} ${t('c:project').toLowerCase()}`,
        description: `${t('c:select')} ${t('c:action').toLowerCase()}`,
        className: 'max-w-md',
      },
    );
  };

  return {
    openRemoveDialog,
    projectWorkspace,
    projectMembership,
  };
}
