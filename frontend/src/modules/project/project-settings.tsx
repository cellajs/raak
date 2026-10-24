import { useSearch } from '@tanstack/react-router';
import { LogOutIcon, UnlinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { ToolCard } from '~/modules/common/tool-card';
import { DeleteToolCard } from '~/modules/entities/channel-settings-tools';
import { useResolveCan } from '~/modules/entities/use-resolve-can';
import { DeleteProjects } from '~/modules/project/delete-projects';
import { MoveProjectForm } from '~/modules/project/move-project-form';
import type { EnrichedProject } from '~/modules/project/types';
import { UpdateProjectForm } from '~/modules/project/update-project-form';
import { useProjectMembershipActions } from '~/modules/project/use-project-membership-actions';
import { selectBoardProject } from '~/modules/task/helpers/board-navigation';
import { Button } from '~/modules/ui/button';
import { useOrganizationWorkspaces } from '~/modules/workspace/query';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';

interface ProjectSettingsProps {
  project: EnrichedProject;
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
  const { t } = useTranslation();
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });
  const isInWorkspace = useIsWorkspaceRoute();

  const resolveCan = useResolveCan();
  const canUpdate = resolveCan(project.can?.project?.update, project.createdBy);
  const canDelete = resolveCan(project.can?.project?.delete, project.createdBy);

  const workspaces = useOrganizationWorkspaces(project.organizationId);
  const canMoveProjects = workspaces.length > 1;

  const closeSettingsSheet = () => {
    sheeter.getState().remove('update-project');
  };

  const { isLeavingProject, isRemovingProjectFromWorkspace, leaveProject, projectHasWorkspace, removeProjectFromWorkspace } =
    useProjectMembershipActions({ isInWorkspace, project, onSuccess: closeSettingsSheet });

  const handleDeleted = (args: CallbackArgs<Project[]>) => {
    if (args.status !== 'success') return;
    closeSettingsSheet();

    // Clearing the param makes the board default to the first remaining project.
    if (projectSlug === project.slug) selectBoardProject();
  };

  return (
    <div className="mb-12 flex flex-col gap-8">
      {canUpdate && (
        <ToolCard label="c:general">
          <UpdateProjectForm project={project} />
        </ToolCard>
      )}

      {(canMoveProjects || projectHasWorkspace) && (
        <ToolCard label="c:workspace" description={t('c:project_workspace_settings.text')}>
          <div className="flex flex-col gap-6">
            {canMoveProjects && <MoveProjectForm project={project} workspaces={workspaces} onSuccess={closeSettingsSheet} />}
            {projectHasWorkspace && (
              <Button
                variant="destructive"
                className="w-full sm:w-fit"
                soft
                onClick={removeProjectFromWorkspace}
                disabled={isRemovingProjectFromWorkspace}
              >
                <UnlinkIcon />
                <span>{isRemovingProjectFromWorkspace ? t('c:loading') : t('c:remove_project_from_workspace')}</span>
              </Button>
            )}
          </div>
        </ToolCard>
      )}

      <ToolCard label="c:project_membership" description={t('c:project_membership_settings.text')}>
        <Button variant="destructive" className="w-full sm:w-auto" soft onClick={leaveProject} disabled={isLeavingProject}>
          <LogOutIcon />
          <span>{isLeavingProject ? t('c:loading') : t('c:leave_project')}</span>
        </Button>
      </ToolCard>

      {canDelete && (
        <DeleteToolCard
          name={project.name}
          resource="c:project"
          dialogId="delete-project"
          renderDialog={() => <DeleteProjects projects={[project]} callback={handleDeleted} />}
        />
      )}
    </div>
  );
}
