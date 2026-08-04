import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { LogOutIcon, UnlinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project, Workspace } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { ToolCard } from '~/modules/common/tool-card';
import { ToolsArrangementCard } from '~/modules/entities/tools-arrangement-card';
import { DeleteProjects } from '~/modules/project/delete-projects';
import { MoveProjectForm } from '~/modules/project/move-project-form';
import { useProjectUpdateMutation } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { UpdateProjectForm } from '~/modules/project/update-project-form';
import { useProjectMembershipActions } from '~/modules/project/use-project-membership-actions';
import { Button } from '~/modules/ui/button';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';

const closeSettingsSheet = () => useSheeter.getState().remove('update-project');

/** General project form body (name, slug, visuals). */
export function ProjectGeneralForm({ project }: { project: EnrichedProject }) {
  return <UpdateProjectForm project={project} sheet />;
}

/** Workspace card: move the project between workspaces or disconnect it from its workspace. */
export function ProjectWorkspaceCard({ project }: { project: EnrichedProject }) {
  const { t } = useTranslation();
  const { tenantId } = useOrganizationLayoutContext();
  const boardType = useBoardStore((state) => state.activeBoardType);

  const { data: workspacesData } = useInfiniteQuery({
    ...workspacesListQueryOptions({ organizationId: project.organizationId }),
    refetchOnMount: false,
  });
  const workspaces = flattenInfiniteData<Workspace>(workspacesData);
  const canMoveProjects = workspaces.length > 1;

  const { isRemovingProjectFromWorkspace, projectHasWorkspace, removeProjectFromWorkspace } =
    useProjectMembershipActions({ boardType, project, tenantId, onSuccess: closeSettingsSheet });

  if (!canMoveProjects && !projectHasWorkspace) return null;

  return (
    <ToolCard label="c:workspace" description={t('c:project_workspace_settings.text')}>
      <div className="flex flex-col gap-6">
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
      </div>
    </ToolCard>
  );
}

/** Membership card: leave the project. Only rendered for actors with a direct membership. */
export function ProjectMembershipCard({ project }: { project: EnrichedProject }) {
  const { t } = useTranslation();
  const { tenantId } = useOrganizationLayoutContext();
  const boardType = useBoardStore((state) => state.activeBoardType);

  const { isLeavingProject, leaveProject } = useProjectMembershipActions({
    boardType,
    project,
    tenantId,
    onSuccess: closeSettingsSheet,
  });

  if (!project.membership) return null;

  return (
    <ToolCard label="c:project_membership" description={t('c:project_membership_settings.text')}>
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
    </ToolCard>
  );
}

/** Tools arrangement card wired to the project update mutation. */
export function ProjectToolsCard({ project }: { project: EnrichedProject }) {
  const { mutate } = useProjectUpdateMutation();
  return (
    <ToolsArrangementCard
      entity={project}
      persist={(toolsConfig) =>
        mutate({
          path: { id: project.id, organizationId: project.organizationId, tenantId: project.tenantId },
          body: { toolsConfig },
        })
      }
    />
  );
}

/** Delete confirmation content for the project danger zone. */
export function ProjectDeleteDialog({ project }: { project: EnrichedProject }) {
  const navigate = useNavigate();
  const { projectSlug } = useSearch({ strict: false }) as { projectSlug?: string };

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

  return <DeleteProjects dialog projects={[project]} callback={callback} />;
}
