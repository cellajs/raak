import '@uppy/core/css/style.css';
import '@uppy/dashboard/css/style.css';

import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  EllipsisVerticalIcon,
  MergeIcon,
  ReplaceIcon,
  SettingsIcon,
  SplitIcon,
  SquareSplitHorizontalIcon,
  UserRoundXIcon,
  UsersIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { MoveProjectForm } from '~/modules/project/move-project-form';
import { SplitProjectPanelDialog } from '~/modules/project/split-project-panel';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/task/helpers/project-actions';
import { TaskStatus } from '~/modules/task/task-properties';
import { Button } from '~/modules/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/modules/ui/dropdown-menu';
import { workspaceQueryKeys } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic';
import { queryClient } from '~/query/query-client';
import router from '~/routes/router';
import { cn } from '~/utils/cn';
import { useProjectMembershipActions } from './use-project-membership-actions';

const PanelProjectActions = ({ project, className }: { project: EnrichedProject; className?: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const boardId = useBoardStore((state) => state.activeBoardId)!;
  const boardType = useBoardStore((state) => state.activeBoardType)!;

  const panelsSectionView = useTaskBoardStore((state) => state.panelData[boardId]?.[project.id]?.viewSections);
  const setPanelSections = useTaskBoardStore((state) => state.setPanelSections);
  const dropPanelSections = useTaskBoardStore((state) => state.dropPanelSections);

  const { organization, tenantId } = useOrganizationLayoutContext();

  const projectButtonRef = useRef<HTMLButtonElement | null>(null);

  // Check if projects can be moved — count workspaces from menu cache
  const cachedQueries = queryClient.getQueriesData({ queryKey: workspaceQueryKeys.list.base });
  // biome-ignore lint/suspicious/noExplicitAny: cache data is untyped
  const canMoveProjects = cachedQueries.some(([, data]) => flattenInfiniteData(data as any).length > 1);

  const { openRemoveDialog, projectMembership, projectWorkspace } = useProjectMembershipActions({
    boardType,
    project,
    tenantId,
    projectButtonRef,
  });

  const moveProject = () => {
    useDialoger.getState().create(<MoveProjectForm project={project} dialog />, {
      id: 'move-project-form',
      triggerRef: { current: null },
      title: t('c:move_project'),
      description: t('c:move_project.text'),
      className: 'max-w-2xl',
    });
  };

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

  useEffect(() => {
    const unsubscribe = router.subscribe('onBeforeLoad', () => useDialoger.getState().remove('create-task'));
    return () => unsubscribe();
  }, []);

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
        {projectMembership?.role === 'admin' && (
          <DropdownMenuItem
            onClick={() => openProjectSettingsSheet(project, projectButtonRef)}
            className="flex items-center gap-2"
          >
            <SettingsIcon size={16} />
            <span>{t('c:resource_settings', { resource: t('c:project') })}</span>
          </DropdownMenuItem>
        )}
        {canMoveProjects && (
          <DropdownMenuItem onClick={moveProject} className="flex items-center gap-2">
            <ReplaceIcon size={16} />
            <span>{t('c:move_project')}</span>
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

        {projectMembership && (
          <DropdownMenuItem onClick={openRemoveDialog} className="flex items-center gap-2">
            <UserRoundXIcon size={16} />
            <span>{t('c:remove')}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default PanelProjectActions;
