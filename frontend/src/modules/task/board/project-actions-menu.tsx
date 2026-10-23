import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon, EllipsisVerticalIcon, SettingsIcon, SquareSplitHorizontalIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useBoardStore } from '~/modules/common/board/board-store';
import { DropdownActionItem } from '~/modules/common/dropdowner/dropdown-action-item';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { organizationQueryOptions } from '~/modules/organization/query';
import { openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import type { EnrichedProject } from '~/modules/project/types';
import { useProjectViewSections, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { TaskStatus } from '~/modules/task/task-properties';
import { Button } from '~/modules/ui/button';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { cn } from '~/utils/cn';

interface ProjectActionsMenuProps {
  project: EnrichedProject;
  className?: string;
}

/** Project menu: in the project panel header on a workspace board, in the board header on a project page. */
export function ProjectActionsMenu({ project, className }: ProjectActionsMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const boardId = useBoardStore((state) => state.activeBoardId)!;
  const isInWorkspace = useIsWorkspaceRoute();

  const viewSections = useProjectViewSections(project.id);
  const setPanelSections = useTaskBoardStore((state) => state.setPanelSections);
  const dropPanelSections = useTaskBoardStore((state) => state.dropPanelSections);

  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));

  const projectMembership = project.membership;
  const projectWorkspace = projectMembership?.workspaceId ? findWorkspaceByIdOrSlug(projectMembership.workspaceId, tenantId) : undefined;

  const openOptionsDropdown = (currentTarget: HTMLButtonElement) => {
    const isMobile = window.innerWidth < 640;
    const triggerRef = { current: currentTarget };
    const closeThen = (action: () => void) => () => {
      dropdowner.getState().remove();
      action();
    };

    dropdowner.getState().create(
      <>
        {isInWorkspace && (
          <DropdownActionItem
            isMobile={isMobile}
            icon={ArrowRightIcon}
            onSelect={closeThen(() =>
              navigate({
                to: '/$tenantId/$organizationSlug/project/$slug',
                params: { slug: project.slug, organizationSlug: organization.slug, tenantId },
              }),
            )}
          >
            {t('c:go_to_project')}
          </DropdownActionItem>
        )}
        {!isInWorkspace && projectWorkspace && (
          <DropdownActionItem
            isMobile={isMobile}
            icon={ArrowRightIcon}
            onSelect={closeThen(() =>
              navigate({
                to: '/$tenantId/$organizationSlug/workspace/$slug',
                params: { slug: projectWorkspace.slug, organizationSlug: organization.slug, tenantId },
                search: { projectSlug: project.slug },
              }),
            )}
          >
            {t('c:go_to_workspace')}
          </DropdownActionItem>
        )}
        {projectMembership && (
          <>
            <DropdownActionItem isMobile={isMobile} icon={UsersIcon} onSelect={closeThen(() => openProjectMembersSheet(project, triggerRef))}>
              {t('c:project_members')}
            </DropdownActionItem>
            <DropdownActionItem isMobile={isMobile} icon={SettingsIcon} onSelect={closeThen(() => openProjectSettingsSheet(project, triggerRef))}>
              {t('c:resource_settings', { resource: t('c:project') })}
            </DropdownActionItem>
          </>
        )}
        {!isMobile && (
          <DropdownActionItem
            isMobile={isMobile}
            icon={SquareSplitHorizontalIcon}
            onSelect={closeThen(() =>
              viewSections
                ? dropPanelSections(boardId, project.id)
                : setPanelSections(boardId, project.id, [
                    { status: [TaskStatus.Accepted, TaskStatus.Reviewed, TaskStatus.Delivered, TaskStatus.Finished, TaskStatus.Started] },
                    { status: [TaskStatus.Unstarted, TaskStatus.Iced] },
                  ]),
            )}
          >
            {viewSections ? t('c:merge') : t('c:split')}
          </DropdownActionItem>
        )}
      </>,
      {
        id: `project-options-${project.id}`,
        triggerId: `project-options-btn-${project.id}`,
        triggerRef,
        align: 'end',
        kind: 'menu',
        popupClassName: 'min-w-48',
      },
    );
  };

  return (
    <TooltipButton toolTipContent={t('c:resource_options', { resource: t('c:project') })}>
      <Button
        variant="ghost"
        aria-label={t('c:resource_options', { resource: t('c:project') })}
        onClick={({ currentTarget }) => openOptionsDropdown(currentTarget)}
        className={cn('data-dropdowner-active:bg-accent/50', className)}
      >
        <EllipsisVerticalIcon />
      </Button>
    </TooltipButton>
  );
}
