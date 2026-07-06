import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { LogOutIcon, Trash2, UnlinkIcon } from 'lucide-react';
import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Project, Workspace } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import DeleteProjects from '~/modules/project/delete-projects';
import { MoveProjectForm } from '~/modules/project/move-project-form';
import type { EnrichedProject } from '~/modules/project/types';
import UpdateProjectForm from '~/modules/project/update-project-form';
import { useProjectMembershipActions } from '~/modules/project/use-project-membership-actions';
import { Button } from '~/modules/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/modules/ui/card';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';

export const ProjectSettings = ({ sheet: isSheet, project }: { sheet?: boolean; project: EnrichedProject }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { tenantId } = useOrganizationLayoutContext();
  const { projectSlug } = useSearch({ strict: false }) as { projectSlug?: string };
  const boardType = useBoardStore((state) => state.activeBoardType);

  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const isAdmin = project.membership?.role === 'admin';

  const { data: workspacesData } = useInfiniteQuery({
    ...workspacesListQueryOptions({ organizationId: project.organizationId }),
    refetchOnMount: false,
  });
  const workspaces = flattenInfiniteData<Workspace>(workspacesData);
  const canMoveProjects = workspaces.length > 1;

  const closeSettingsSheet = () => {
    if (isSheet) useSheeter.getState().remove('update-project');
  };

  const {
    isLeavingProject,
    isRemovingProjectFromWorkspace,
    leaveProject,
    projectHasWorkspace,
    removeProjectFromWorkspace,
  } = useProjectMembershipActions({
    boardType,
    project,
    tenantId,
    onSuccess: closeSettingsSheet,
  });

  const callback = (deletedProjects: Project[]) => {
    closeSettingsSheet();

    // If the deleted project is the currently selected one, clear the search param
    // so the board defaults to the first remaining project
    const deletedSlugs = new Set(deletedProjects.map(({ slug }) => slug));
    if (projectSlug && deletedSlugs.has(projectSlug)) {
      navigate({
        to: '.',
        params: true,
        resetScroll: false,
        search: (prev) => ({ ...prev, projectSlug: undefined }),
      });
    }
  };

  const openDeleteDialog = () => {
    useDialoger.getState().create(<DeleteProjects dialog projects={[project]} callback={callback} />, {
      id: 'delete-project',
      triggerRef: deleteButtonRef,
      className: 'md:max-w-xl',
      title: t('c:delete_resource', { resource: t('c:project').toLowerCase() }),
      description: t('c:confirm.delete_resource', {
        name: project.name,
        resource: t('c:project').toLowerCase(),
      }),
    });
  };

  return (
    <div className="mb-12 flex flex-col gap-8">
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{t('c:general')}</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdateProjectForm project={project} sheet={isSheet} />
          </CardContent>
        </Card>
      )}

      {(canMoveProjects || projectHasWorkspace) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('c:workspace')}</CardTitle>
            <CardDescription>{t('c:project_workspace_settings.text')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {canMoveProjects && (
              <MoveProjectForm project={project} workspaces={workspaces} onSuccess={closeSettingsSheet} />
            )}
            {projectHasWorkspace && (
              <Button
                variant="destructive"
                className="w-full sm:w-fit"
                soft
                onClick={() => removeProjectFromWorkspace()}
                disabled={isRemovingProjectFromWorkspace}
              >
                <UnlinkIcon className="mr-2 size-4" />
                <span>{isRemovingProjectFromWorkspace ? t('c:loading') : t('c:remove_project_from_workspace')}</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('c:project_membership')}</CardTitle>
          <CardDescription>{t('c:project_membership_settings.text')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            soft
            onClick={() => leaveProject()}
            disabled={isLeavingProject}
          >
            <LogOutIcon className="mr-2 size-4" />
            <span>{isLeavingProject ? t('c:loading') : t('c:leave_project')}</span>
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>{t('c:delete_resource', { resource: t('c:project').toLowerCase() })}</CardTitle>
            <CardDescription>
              <Trans
                i18nKey="c:delete_resource_notice.text"
                values={{ name: project.name, resource: t('c:project').toLowerCase() }}
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button ref={deleteButtonRef} variant="destructive" className="w-full sm:w-auto" onClick={openDeleteDialog}>
              <Trash2 className="mr-2 h-4 w-4" />
              <span>{t('c:delete_resource', { resource: t('c:project').toLowerCase() })}</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
