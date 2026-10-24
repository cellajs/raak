import { useSearch } from '@tanstack/react-router';
import { LogOutIcon, UnlinkIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { NamedText } from '~/modules/common/named-text';
import { openConfirm } from '~/modules/common/open-confirm';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { toaster } from '~/modules/common/toaster/toaster';
import { ToolCard } from '~/modules/common/tool-card';
import { DeleteToolCard } from '~/modules/entities/channel-settings-tools';
import { LeaveChannelForm } from '~/modules/memberships/leave-channel-form';
import { DeleteProjects } from '~/modules/project/delete-projects';
import { MoveProjectForm } from '~/modules/project/move-project-form';
import { useProjectRemoveWorkspaceMutation } from '~/modules/project/query';
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
  const { mutate: removeWorkspace, isPending: isRemoving } = useProjectRemoveWorkspaceMutation();

  const canMove = workspaces.length > 1;
  const hasWorkspace = !!project.membership?.workspaceId;
  if (!canMove && !hasWorkspace) return null;

  const removeFromWorkspace = () =>
    removeWorkspace(
      { path: { id: project.id, organizationId: project.organizationId, tenantId: project.tenantId } },
      {
        onSuccess: () => {
          toaster.success(t('c:success.project_disconnected'));
          closeSettingsSheet();
        },
      },
    );

  const openRemoveConfirm = (event: MouseEvent<HTMLButtonElement>) =>
    openConfirm(event.currentTarget, {
      id: `remove-project-workspace-${project.id}`,
      title: <NamedText i18nKey="c:confirm.remove_project_from_workspace" name={project.name} />,
      label: 'c:remove',
      icon: UnlinkIcon,
      onConfirm: removeFromWorkspace,
    });

  return (
    <ToolCard label="c:workspace" description={t('c:project_workspace_settings.text')}>
      <div className="flex flex-col gap-6">
        {canMove && <MoveProjectForm project={project} workspaces={workspaces} onSuccess={closeSettingsSheet} />}
        {hasWorkspace && (
          <Button variant="destructive" className="w-full sm:w-fit" soft loading={isRemoving} onClick={openRemoveConfirm}>
            <UnlinkIcon />
            <span>{t('c:remove_project_from_workspace')}</span>
          </Button>
        )}
      </div>
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
