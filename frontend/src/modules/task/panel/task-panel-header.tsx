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
import { NewTaskButton } from '~/modules/task/board/new-task-button';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import { listStatusNames } from '~/modules/task/helpers/board-helpers';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { PanelStatusIcon, PanelStatusTitle } from '~/modules/task/panel/panel-status-title';
import { panelHandleClass } from '~/modules/task/task-styles';
import { Badge } from '~/modules/ui/badge';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { findMembership } from '~/query/enrichment/helpers';
import { cn } from '~/utils/cn';

interface PanelLeadingProps extends Pick<BoardPanelProps, 'project' | 'statuses'> {
  isInWorkspace: boolean;
  isCollapsed: boolean;
  count: number;
}

function PanelLeading({ project, statuses, isInWorkspace, isCollapsed, count }: PanelLeadingProps) {
  const { t } = useTranslation();
  // Off outside a workspace: a public board may have no session to ask with
  const { data: role } = useQuery({
    ...myMembershipsQueryOptions(),
    enabled: isInWorkspace,
    select: (data) => findMembership(data.items, project.id)?.role,
  });

  if (isInWorkspace) {
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
        className={cn(panelHandleClass, 'min-w-0 no-underline', isCollapsed ? 'w-full justify-center' : 'pr-2')}
      >
        {!isCollapsed && (
          // The header's full height: the handle clips its label, so the name rises and the role shows within this box
          <span className="relative block h-8">
            <span
              className={cn(
                'block truncate pt-1.5 font-semibold leading-5',
                role && 'transition-transform duration-100 ease-in-out group-hover/panel-head:-translate-y-1.5 group-hover/panel-head:delay-300',
              )}
            >
              {project.name}
            </span>
            {role && (
              <span className="pointer-events-none absolute top-5 left-0 text-muted-foreground text-xs leading-3 opacity-0 transition-opacity duration-100 ease-in-out group-hover/panel-head:opacity-100 group-hover/panel-head:delay-300">
                {t(role)}
              </span>
            )}
          </span>
        )}
      </PanelDragHandleButton>
    );
  }

  // In a project view the project identity lives in the page header
  const name = statuses ? listStatusNames(statuses) : t('c:task_other');
  return (
    <PanelDragHandleButton
      name={name}
      fallbackLabel={name}
      icon={<PanelStatusIcon statuses={statuses} isCollapsed={isCollapsed} />}
      className={cn(panelHandleClass, 'min-h-8 truncate', isCollapsed ? 'w-full justify-center' : 'pr-2')}
    >
      {!isCollapsed && <PanelStatusTitle statuses={statuses} count={count} />}
    </PanelDragHandleButton>
  );
}

interface TaskPanelHeaderProps extends Pick<BoardPanelProps, 'project' | 'publicView' | 'statuses' | 'windowScroll'> {
  panelId: string;
  count: number;
}

/** A project's panel header. */
export function TaskPanelHeader({ project, publicView, statuses, panelId, windowScroll, count }: TaskPanelHeaderProps) {
  const { t } = useTranslation();

  const isInWorkspace = useIsWorkspaceRoute();

  const isCollapsed = useBoardStore((state) => !!state.panelCollapseState[panelId]);
  const isReadOnly = useIsProjectReadOnly(project.id);

  const actionsSlot = !isCollapsed ? (
    <>
      {isReadOnly && isInWorkspace && (
        <Badge soft className="font-normal text-xs">
          {t('c:read_only')}
        </Badge>
      )}
      {!publicView && isInWorkspace && <ProjectActionsMenu project={project} className="h-8 px-1.5" />}
      {isInWorkspace && <NewTaskButton project={project} className="-ml-1" />}
    </>
  ) : undefined;

  return (
    <BoardPanelHeader
      className={cn('group/panel-head bg-card', windowScroll && 'sticky top-0')}
      leading={<PanelLeading project={project} statuses={statuses} isInWorkspace={isInWorkspace} isCollapsed={isCollapsed} count={count} />}
      actions={actionsSlot}
      isCollapsed={isCollapsed}
    />
  );
}
