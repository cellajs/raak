import { PlusIcon, SquareCheckBigIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BoardPanelHeader } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/common/board/panel-drag-handle-button';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { EntityChip } from '~/modules/common/entity-chip';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import { useProjectViewSections } from '~/modules/task/board/task-board-store';
import { projectPanelIds } from '~/modules/task/helpers/board-helpers';
import { createTaskFormId, type NewTaskFormValues, newTaskFormIsDirty, toggleCreateTaskForm } from '~/modules/task/helpers/create-task';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { newTaskButtonClass, panelHandleClass } from '~/modules/task/task-styles';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { cn } from '~/utils/cn';

interface PanelLeadingProps extends Pick<BoardPanelProps, 'project'> {
  isInWorkspace: boolean;
  isCollapsed: boolean;
}

function PanelLeading({ project, isInWorkspace, isCollapsed }: PanelLeadingProps) {
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
  return (
    <PanelDragHandleButton
      name={t('c:task_other')}
      fallbackLabel={t('c:task_other')}
      icon={
        <div className="flex min-w-8 justify-center">
          <SquareCheckBigIcon className="size-4 shrink-0" />
        </div>
      }
      className={cn(panelHandleClass, 'min-h-8 truncate', isCollapsed ? 'w-full justify-center' : 'pr-2')}
    >
      {!isCollapsed && <div className="truncate font-semibold leading-6">{t('c:task_other')}</div>}
    </PanelDragHandleButton>
  );
}

/** A project's panel header; over a split project it spans the sections, and collapses with the last of them. */
export function TaskPanelHeader({ project, publicView }: Pick<BoardPanelProps, 'project' | 'publicView'>) {
  const { t } = useTranslation();

  const isInWorkspace = useIsWorkspaceRoute();

  const viewSections = useProjectViewSections(project.id);
  const isCollapsed = useBoardStore((state) => projectPanelIds(project.id, viewSections).every((panelId) => state.panelCollapseState[panelId]));

  const formId = createTaskFormId(project.id);
  const hasDraft = useDraftStore((state) => {
    const storedForm = state.getForm<NewTaskFormValues>(formId);
    return !!storedForm && newTaskFormIsDirty(storedForm);
  });

  const isReadOnly = useIsProjectReadOnly(project.id);
  const isCreateFormOpen = useTaskInteractionStore((state) => state.draftTasks[project.id] !== undefined);

  const toggleCreateForm = () => toggleCreateTaskForm(project);

  const actionsSlot = !isCollapsed ? (
    <>
      {isReadOnly && (
        <Badge soft className="font-normal text-xs">
          {t('c:read_only')}
        </Badge>
      )}
      {!publicView && isInWorkspace && <ProjectActionsMenu project={project} className="h-8 px-1.5" />}
      {!isReadOnly && (
        <Button data-form-dirty={hasDraft} variant="secondary" size="xs" className={newTaskButtonClass} onClick={toggleCreateForm}>
          <Badge className="absolute -top-1 -right-1 z-100 in-data-[form-dirty=false]:hidden size-2 p-0" />
          <PlusIcon className={cn('size-4.5 transition-transform duration-200', isCreateFormOpen && 'rotate-45')} />
          <span>{t('c:task')}</span>
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <BoardPanelHeader
      // The separators between sections leave gaps in their top line: this line runs on above them
      className={cn('bg-card', viewSections?.length && 'border-b')}
      leading={<PanelLeading project={project} isInWorkspace={isInWorkspace} isCollapsed={isCollapsed} />}
      actions={actionsSlot}
      isCollapsed={isCollapsed}
    />
  );
}
