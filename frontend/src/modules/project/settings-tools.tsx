import { useSearch } from '@tanstack/react-router';
import { LogOutIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { NamedText } from '~/modules/common/named-text';
import { openConfirm } from '~/modules/common/open-confirm';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { ToolCard } from '~/modules/common/tool-card';
import { DeleteToolCard } from '~/modules/entities/channel-settings-tools';
import { LeaveChannelForm } from '~/modules/memberships/leave-channel-form';
import { DeleteProjects } from '~/modules/project/delete-projects';
import { MoveProjectForm } from '~/modules/project/move-project-form';
import type { EnrichedProject } from '~/modules/project/types';
import { UpdateProjectForm } from '~/modules/project/update-project-form';
import { selectBoardProject } from '~/modules/task/helpers/board-navigation';
import { Button } from '~/modules/ui/button';
import { useOrganizationWorkspaces } from '~/modules/workspace/query';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';

interface ProjectCardProps {
  project: EnrichedProject;
}

const closeSettingsSheet = () => sheeter.getState().remove('update-project');

export function ProjectGeneralCard({ project }: ProjectCardProps) {
  return (
    <ToolCard label="c:general">
      <UpdateProjectForm project={project} />
    </ToolCard>
  );
}

export function ProjectWorkspaceCard({ project }: ProjectCardProps) {
  const { t } = useTranslation();
  const workspaces = useOrganizationWorkspaces(project.organizationId);

  if (workspaces.length < 2) return null;

  return (
    <ToolCard label="c:workspace" description={t('c:project_workspace_settings.text')}>
      <MoveProjectForm project={project} workspaces={workspaces} onSuccess={closeSettingsSheet} />
    </ToolCard>
  );
}

export function ProjectMembershipCard({ project }: ProjectCardProps) {
  const { t } = useTranslation();
  const isInWorkspace = useIsWorkspaceRoute();

  const openLeaveConfirm = (event: MouseEvent<HTMLButtonElement>) =>
    openConfirm(event.currentTarget, {
      id: `leave-channel-${project.id}`,
      title: <NamedText i18nKey="c:confirm.leave_channel" name={project.name} />,
      content: <LeaveChannelForm channel={project} redirectPath={isInWorkspace ? null : '/home'} callback={closeSettingsSheet} />,
    });

  return (
    <ToolCard label="c:project_membership" description={t('c:project_membership_settings.text')}>
      <Button variant="destructive" className="w-full sm:w-auto" soft onClick={openLeaveConfirm}>
        <LogOutIcon />
        <span>{t('c:leave_project')}</span>
      </Button>
    </ToolCard>
  );
}

export function ProjectDeleteCard({ project }: ProjectCardProps) {
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });

  const handleDeleted = (args: CallbackArgs<Project[]>) => {
    if (args.status !== 'success') return;
    closeSettingsSheet();

    // Clearing the param makes the board default to the first remaining project.
    if (projectSlug === project.slug) selectBoardProject();
  };

  return (
    <DeleteToolCard
      name={project.name}
      resource="c:project"
      dialogId="delete-project"
      renderDialog={() => <DeleteProjects projects={[project]} callback={handleDeleted} />}
    />
  );
}
