import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon, EllipsisVerticalIcon, SettingsIcon, SquareSplitHorizontalIcon, UsersIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useBoardStore } from '~/modules/common/board/board-store';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { organizationQueryOptions } from '~/modules/organization/query';
import { openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { TaskStatus } from '~/modules/task/task-properties';
import { Button } from '~/modules/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/modules/ui/dropdown-menu';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';

/** Project menu: in the project panel header on a workspace board, in the board header on a project page. */
export function ProjectActionsMenu({ project, className }: { project: EnrichedProject; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const boardId = useBoardStore((state) => state.activeBoardId)!;
  const isInWorkspace = useIsWorkspaceRoute();

  const panelsSectionView = useTaskBoardStore((state) => state.panelData[boardId]?.[project.id]?.viewSections);
  const setPanelSections = useTaskBoardStore((state) => state.setPanelSections);
  const dropPanelSections = useTaskBoardStore((state) => state.dropPanelSections);

  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));

  const projectButtonRef = useRef<HTMLButtonElement | null>(null);

  const projectMembership = project.membership;
  const projectWorkspace = projectMembership?.workspaceId ? findWorkspaceByIdOrSlug(projectMembership.workspaceId, tenantId) : undefined;

  return (
    <DropdownMenu>
      <TooltipButton toolTipContent={t('c:resource_options', { resource: t('c:project') })}>
        <DropdownMenuTrigger render={<Button variant="ghost" className={className} />} ref={projectButtonRef}>
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
      </TooltipButton>
      <DropdownMenuContent className="min-w-48 p-1" align="end">
        {isInWorkspace && (
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '/$tenantId/$organizationSlug/project/$slug',
                params: { slug: project.slug, organizationSlug: organization.slug, tenantId },
              })
            }
            className="flex items-center gap-2"
          >
            <ArrowRightIcon />
            <span>{t('c:go_to_project')}</span>
          </DropdownMenuItem>
        )}
        {!isInWorkspace && projectWorkspace && (
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '/$tenantId/$organizationSlug/workspace/$slug',
                params: { slug: projectWorkspace.slug, organizationSlug: organization.slug, tenantId },
                search: { projectSlug: project.slug },
              })
            }
            className="flex items-center gap-2"
          >
            <ArrowRightIcon />
            <span>{t('c:go_to_workspace')}</span>
          </DropdownMenuItem>
        )}
        {projectMembership && (
          <DropdownMenuItem onClick={() => openProjectMembersSheet(project, projectButtonRef)} className="flex items-center gap-2">
            <UsersIcon />
            <span>{t('c:project_members')}</span>
          </DropdownMenuItem>
        )}
        {projectMembership && (
          <DropdownMenuItem onClick={() => openProjectSettingsSheet(project, projectButtonRef)} className="flex items-center gap-2">
            <SettingsIcon />
            <span>{t('c:resource_settings', { resource: t('c:project') })}</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() =>
            panelsSectionView
              ? dropPanelSections(boardId, project.id)
              : setPanelSections(boardId, project.id, [
                  { status: [TaskStatus.Accepted, TaskStatus.Reviewed, TaskStatus.Delivered, TaskStatus.Finished, TaskStatus.Started] },
                  { status: [TaskStatus.Unstarted, TaskStatus.Iced] },
                ])
          }
          className="flex items-center gap-2 max-sm:hidden"
        >
          <SquareSplitHorizontalIcon />
          {panelsSectionView ? <span>{t('c:merge')}</span> : <span>{t('c:split')}</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
