import '@uppy/core/css/style.css';
import '@uppy/dashboard/css/style.css';

import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  EllipsisVerticalIcon,
  MergeIcon,
  SettingsIcon,
  SplitIcon,
  SquareSplitHorizontalIcon,
  UsersIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import { SplitProjectPanelDialog } from '~/modules/project/split-project-panel';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { TaskStatus } from '~/modules/task/task-properties';
import { Button } from '~/modules/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/modules/ui/dropdown-menu';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { cn } from '~/utils/cn';

export const PanelProjectActions = ({ project, className }: { project: EnrichedProject; className?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const boardId = useBoardStore((state) => state.activeBoardId)!;
  const boardType = useBoardStore((state) => state.activeBoardType)!;

  const panelsSectionView = useTaskBoardStore((state) => state.panelData[boardId]?.[project.id]?.viewSections);
  const setPanelSections = useTaskBoardStore((state) => state.setPanelSections);
  const dropPanelSections = useTaskBoardStore((state) => state.dropPanelSections);

  const { organization, tenantId } = useOrganizationLayoutContext();

  const projectButtonRef = useRef<HTMLButtonElement | null>(null);

  const projectMembership = project.membership;
  const projectWorkspace = projectMembership?.workspaceId
    ? findWorkspaceByIdOrSlug(projectMembership.workspaceId, tenantId)
    : undefined;

  const splitProjectPanels = () => {
    useDialoger
      .getState()
      .create(
        <SplitProjectPanelDialog boardId={boardId} projectId={project.id} panelsSectionView={panelsSectionView} />,
        {
          id: `split-${boardId}`,
          triggerRef: projectButtonRef,
          title: t('c:split'),
          description: t('c:split.text'),
          className: 'max-w-2xl',
        },
      );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className=""
        render={<Button variant="ghost" className={cn('max-sm:hidden', className)} aria-label="Project options" />}
        ref={projectButtonRef}
      >
        <EllipsisVerticalIcon size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48 p-1" align="end">
        {boardType === 'workspace' && (
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '/$tenantId/$organizationSlug/project/$slug',
                params: { slug: project.slug, organizationSlug: organization.slug, tenantId },
              })
            }
            className="flex items-center gap-2"
          >
            <ArrowRightIcon size={16} />
            <span>{t('c:go_to_project')}</span>
          </DropdownMenuItem>
        )}
        {boardType === 'project' && projectWorkspace && (
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
            <ArrowRightIcon size={16} />
            <span>{t('c:go_to_workspace')}</span>
          </DropdownMenuItem>
        )}
        {projectMembership && (
          <DropdownMenuItem
            onClick={() => openProjectMembersSheet(project, projectButtonRef)}
            className="flex items-center gap-2"
          >
            <UsersIcon size={16} />
            <span>{t('c:project_members')}</span>
          </DropdownMenuItem>
        )}
        {projectMembership && (
          <DropdownMenuItem
            onClick={() => openProjectSettingsSheet(project, projectButtonRef)}
            className="flex items-center gap-2"
          >
            <SettingsIcon size={16} />
            <span>{t('c:resource_settings', { resource: t('c:project') })}</span>
          </DropdownMenuItem>
        )}

        {boardType === 'project' && (
          <>
            <DropdownMenuItem onClick={splitProjectPanels} className="flex items-center gap-2">
              <SplitIcon size={16} />
              <span>{t('c:split')}</span>
            </DropdownMenuItem>
            {panelsSectionView && (
              <DropdownMenuItem
                onClick={() => dropPanelSections(boardId, project.id)}
                className="flex items-center gap-2"
              >
                <MergeIcon size={16} />
                <span>{t('c:merge')}</span>
              </DropdownMenuItem>
            )}
          </>
        )}

        {boardType === 'workspace' && (
          <DropdownMenuItem
            onClick={() =>
              panelsSectionView
                ? dropPanelSections(boardId, project.id)
                : setPanelSections(boardId, project.id, [
                    {
                      status: [
                        TaskStatus.Accepted,
                        TaskStatus.Reviewed,
                        TaskStatus.Delivered,
                        TaskStatus.Finished,
                        TaskStatus.Started,
                      ],
                    },
                    { status: [TaskStatus.Unstarted, TaskStatus.Iced] },
                  ])
            }
            className="flex items-center gap-2"
          >
            <SquareSplitHorizontalIcon size={16} />
            {panelsSectionView ? <span>{t('c:merge')}</span> : <span>{t('c:split')}</span>}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
