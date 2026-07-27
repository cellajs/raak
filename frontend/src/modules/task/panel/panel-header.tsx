import { FunnelIcon, PlusIcon, SquareCheckBigIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BoardPanelHeader } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { PanelDragHandleButton } from '~/modules/common/board/panel-drag-handle-button';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { formatSectionLabel, makePanelKey } from '~/modules/task/helpers/board-helpers';
import { type NewTaskFormValues, newTaskFormIsDirty, toggleCreateTaskForm } from '~/modules/task/helpers/create-task';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { PanelProjectActions } from '~/modules/task/panel/panel-project-actions';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

/**
 * Header component for task board panels in desktop view. Displays project name/avatar or section filters, along with actions like creating a new task or accessing project actions.
 */
export const TaskPanelHeader = ({
  project,
  sectionFilters,
  publicView,
}: Pick<BoardPanelProps, 'project' | 'sectionFilters' | 'publicView'>) => {
  const { t } = useTranslation();

  const boardId = useBoardStore((state) => state.activeBoardId)!;
  const boardType = useBoardStore((state) => state.activeBoardType)!;

  const isInWorkspace = boardType === 'workspace';

  const panelsSectionView = useTaskBoardStore((state) => state.panelData[boardId]?.[project.id]?.viewSections);
  const panelId = sectionFilters ? makePanelKey(project.id, sectionFilters) : project.id;
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  // Check if a stored draft exists for this project's create-task form with unsaved changes
  const hasDraft = useDraftStore((state) => {
    const dirtyForm = state.forms[`create-task-${project.id}`] as NewTaskFormValues | undefined;
    if (!dirtyForm) return false;
    return newTaskFormIsDirty(dirtyForm);
  });

  // Check if its primary panel
  const isPrimary = (() => {
    if (!panelsSectionView?.length) return true;
    return panelsSectionView[0] === sectionFilters;
  })();

  const isReadOnly = useIsProjectReadOnly(project.id);
  const isCreateFormOpen = useTaskInteractionStore((s) => s.draftTasks[project.id] !== undefined);

  const toggleCreateForm = () => toggleCreateTaskForm(project);

  // Build leading slot
  const leadingSlot = (() => {
    if (isInWorkspace && isPrimary) {
      return (
        <PanelDragHandleButton
          name={project.name}
          fallbackLabel={project.name}
          icon={
            <EntityAvatar
              className="h-8 w-8"
              id={project.id}
              type="project"
              name={project.name}
              url={project.thumbnailUrl}
            />
          }
          className={cn(
            'flex h-auto items-center gap-2 truncate p-0 no-underline hover:bg-transparent',
            isCollapsed ? 'w-full justify-center' : 'justify-start pr-2',
          )}
        >
          {!isCollapsed && <div className="truncate font-semibold leading-6">{project.name}</div>}
        </PanelDragHandleButton>
      );
    }

    // Secondary panel with section filters (split view)
    if (sectionFilters) {
      // In workspace: show project avatar with funnel badge
      if (isInWorkspace) {
        return (
          <PanelDragHandleButton
            name={`${project.name} — ${formatSectionLabel(sectionFilters)}`}
            icon={
              <div className="relative shrink-0">
                <EntityAvatar
                  className="h-8 w-8"
                  id={project.id}
                  type="project"
                  name={project.name}
                  url={project.thumbnailUrl}
                />
                <div className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                  <FunnelIcon className="h-2.5 w-2.5" />
                </div>
              </div>
            }
            className={cn(
              'flex h-auto min-w-0 items-center gap-2 p-0 hover:bg-transparent',
              isCollapsed ? 'w-full justify-center' : 'justify-start',
            )}
          >
            {!isCollapsed && (
              <div className="truncate font-semibold leading-6">
                <span className="pr-1 text-sm">{formatSectionLabel(sectionFilters)}</span>
              </div>
            )}
          </PanelDragHandleButton>
        );
      }

      // In project view: funnel icon + section label as the drag handle.
      return (
        <PanelDragHandleButton
          name={formatSectionLabel(sectionFilters)}
          fallbackLabel={formatSectionLabel(sectionFilters)}
          icon={
            <div className={cn('flex justify-center', 'min-w-8')}>
              <FunnelIcon className="h-4 w-4 shrink-0" />
            </div>
          }
          className={cn(
            'flex h-auto min-h-8 items-center justify-start gap-2 truncate p-0 hover:bg-transparent',
            isCollapsed ? 'w-full justify-center' : 'justify-start pr-2',
          )}
        >
          {!isCollapsed && (
            <div className="truncate font-semibold leading-6">
              <span>{formatSectionLabel(sectionFilters)}</span>
            </div>
          )}
        </PanelDragHandleButton>
      );
    }

    // Unsplit panel in project view: generic tasks handle; project identity lives in the page header.
    return (
      <PanelDragHandleButton
        name={t('c:task_other')}
        fallbackLabel={t('c:task_other')}
        icon={
          <div className={cn('flex justify-center', 'min-w-8')}>
            <SquareCheckBigIcon className="h-4 w-4 shrink-0" />
          </div>
        }
        className={cn(
          'flex h-auto min-h-8 items-center justify-start gap-2 truncate p-0 hover:bg-transparent',
          isCollapsed ? 'w-full justify-center' : 'justify-start pr-2',
        )}
      >
        {!isCollapsed && <div className="truncate font-semibold leading-6">{t('c:task_other')}</div>}
      </PanelDragHandleButton>
    );
  })();

  // Build actions slot
  const actionsSlot = !isCollapsed ? (
    <>
      {isReadOnly && (
        <Badge variant="plain" className="font-normal text-xs opacity-75">
          {t('c:read_only')}
        </Badge>
      )}
      {!publicView && isPrimary && <PanelProjectActions project={project} className="h-8 px-2" />}
      {!isReadOnly && (
        <Button
          data-form-dirty={hasDraft}
          variant="plain"
          size="xs"
          className="relative hidden rounded sm:inline-flex"
          onClick={toggleCreateForm}
        >
          <Badge className="absolute -top-1 -right-1 z-100 flex in-data-[form-dirty=false]:hidden h-2 w-2 justify-center p-0" />
          <PlusIcon className={cn('size-4.5', 'transition-transform duration-200', isCreateFormOpen && 'rotate-45')} />
          <span className="ml-1">{t('c:task')}</span>
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <BoardPanelHeader className="bg-card" leading={leadingSlot} actions={actionsSlot} isCollapsed={!!isCollapsed} />
  );
};
