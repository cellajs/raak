import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BoardPanelHeader } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/common/board/panel-drag-handle-button';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { EntityChip } from '~/modules/common/entity-chip';
import { myMembershipsQueryOptions } from '~/modules/me/query';
import { PublicBadge } from '~/modules/project/public-badge';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { isSampleProject } from '~/modules/sample/sample-content';
import { NewTaskButton } from '~/modules/task/board/new-task-button';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import { projectPanelName } from '~/modules/task/helpers/board-helpers';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { PanelStatusIcons } from '~/modules/task/panel/panel-status-icons';
import { panelHandleClass } from '~/modules/task/task-styles';
import { Badge } from '~/modules/ui/badge';
import { findMembership } from '~/query/enrichment/helpers';
import { cn } from '~/utils/cn';

interface PanelLeadingProps extends Pick<BoardPanelProps, 'project' | 'statuses' | 'group'> {
  isInWorkspace: boolean;
  showProject: boolean;
  isCollapsed: boolean;
}

function PanelLeading({ project, statuses, group, isInWorkspace, showProject, isCollapsed }: PanelLeadingProps) {
  const { t } = useTranslation();
  // Off outside a workspace: a public board may have no session to ask with
  const { data: role } = useQuery({
    ...myMembershipsQueryOptions(),
    enabled: isInWorkspace,
    select: (data) => findMembership(data.items, project.id)?.role,
  });

  if (showProject) {
    return (
      <PanelDragHandleButton
        name={project.name}
        fallbackLabel={project.name}
        icon={
          <span className="relative flex">
            <EntityAvatar id={project.id} type="project" name={project.name} url={project.thumbnailUrl} />
            {project.public && <PublicBadge />}
          </span>
        }
        preview={<EntityChip type="project" id={project.id} name={project.name} url={project.thumbnailUrl} />}
        className={cn(panelHandleClass, 'group/panel-lead min-w-0 no-underline', isCollapsed ? 'w-full justify-center' : 'pr-2')}
      >
        {!isCollapsed && (
          // The header's full height: the handle clips its label, so the name rises and the role shows within this box
          <span className="relative block h-8">
            <span
              className={cn(
                'block truncate pt-1.5 leading-5 font-semibold',
                role && 'transition-transform duration-100 ease-in-out group-hover/panel-lead:-translate-y-1.5 group-hover/panel-lead:delay-300',
              )}
            >
              {project.name}
            </span>
            {role && (
              <span className="text-muted-foreground pointer-events-none absolute top-5 left-0 text-xs leading-3 opacity-0 transition-opacity duration-100 ease-in-out group-hover/panel-lead:opacity-100 group-hover/panel-lead:delay-300">
                {t(role)}
              </span>
            )}
          </span>
        )}
      </PanelDragHandleButton>
    );
  }

  // In a project view the project identity lives in the page header
  const name = projectPanelName(project, group);
  return (
    <PanelDragHandleButton
      name={name}
      fallbackLabel={name}
      icon={statuses && <PanelStatusIcons statuses={statuses} />}
      className={cn(panelHandleClass, 'min-h-8 truncate', isCollapsed ? 'w-full justify-center' : 'pr-2')}
    >
      {!isCollapsed && <span className="leading-6 font-semibold">{name}</span>}
    </PanelDragHandleButton>
  );
}

interface TaskPanelHeaderProps extends Pick<BoardPanelProps, 'project' | 'publicView' | 'statuses' | 'showProject' | 'group' | 'windowScroll'> {
  panelId: string;
}

/** A project's panel header. */
export function TaskPanelHeader({ project, publicView, statuses, showProject, group, panelId, windowScroll }: TaskPanelHeaderProps) {
  const { t } = useTranslation();

  // A project page panel is named by its group; a panel without one is a workspace board's project, unless it names its project outside a workspace
  const isInWorkspace = !group && !showProject;

  const isCollapsed = useBoardStore((state) => !!state.panelCollapseState[panelId]);
  const isReadOnly = useIsProjectReadOnly(project.id);

  const actionsSlot = !isCollapsed ? (
    <>
      {isReadOnly && isInWorkspace && (
        <Badge soft className="text-xs font-normal">
          {t('c:read_only')}
        </Badge>
      )}
      {!isReadOnly && isInWorkspace && isSampleProject(project) && (
        <Badge soft className="text-xs font-normal">
          {t('c:sample')}
        </Badge>
      )}
      {!publicView && isInWorkspace && <ProjectActionsMenu project={project} className="h-8 px-1.5" />}
      {isInWorkspace && <NewTaskButton project={project} className="-ml-1" />}
    </>
  ) : undefined;

  return (
    <BoardPanelHeader
      className={cn('bg-card', windowScroll && 'sticky top-0')}
      leading={
        <PanelLeading
          project={project}
          statuses={statuses}
          group={group}
          isInWorkspace={isInWorkspace}
          showProject={isInWorkspace || !!showProject}
          isCollapsed={isCollapsed}
        />
      }
      actions={actionsSlot}
      isCollapsed={isCollapsed}
    />
  );
}
