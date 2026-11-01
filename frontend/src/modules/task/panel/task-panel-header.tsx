import { useTranslation } from 'react-i18next';
import { BoardPanelHeader } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/common/board/panel-drag-handle-button';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { EntityChip } from '~/modules/common/entity-chip';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { NewTaskButton } from '~/modules/task/board/new-task-button';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import { listStatusNames } from '~/modules/task/helpers/board-helpers';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { PanelStatusIcon, PanelStatusTitle } from '~/modules/task/panel/panel-status-title';
import { panelHandleClass } from '~/modules/task/task-styles';
import { Badge } from '~/modules/ui/badge';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { cn } from '~/utils/cn';

interface PanelLeadingProps extends Pick<BoardPanelProps, 'project' | 'statuses'> {
  isInWorkspace: boolean;
  isCollapsed: boolean;
  count: number;
}

function PanelLeading({ project, statuses, isInWorkspace, isCollapsed, count }: PanelLeadingProps) {
  const { t } = useTranslation();

  if (isInWorkspace) {
    return (
      <PanelDragHandleButton
        name={project.name}
        fallbackLabel={project.name}
        icon={<EntityAvatar id={project.id} type="project" name={project.name} url={project.thumbnailUrl} />}
        preview={<EntityChip type="project" id={project.id} name={project.name} url={project.thumbnailUrl} />}
        className={cn(panelHandleClass, 'truncate no-underline', isCollapsed ? 'w-full justify-center' : 'pr-2')}
      >
        {!isCollapsed && <div className="truncate font-semibold leading-6">{project.name}</div>}
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

interface TaskPanelHeaderProps extends Pick<BoardPanelProps, 'project' | 'publicView' | 'statuses'> {
  panelId: string;
  count: number;
}

/** A project's panel header. */
export function TaskPanelHeader({ project, publicView, statuses, panelId, count }: TaskPanelHeaderProps) {
  const { t } = useTranslation();

  const isInWorkspace = useIsWorkspaceRoute();

  const isCollapsed = useBoardStore((state) => !!state.panelCollapseState[panelId]);
  const isReadOnly = useIsProjectReadOnly(project.id);

  const actionsSlot = !isCollapsed ? (
    <>
      {isReadOnly && panelId === project.id && (
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
      className="bg-card"
      leading={<PanelLeading project={project} statuses={statuses} isInWorkspace={isInWorkspace} isCollapsed={isCollapsed} count={count} />}
      actions={actionsSlot}
      isCollapsed={isCollapsed}
    />
  );
}
