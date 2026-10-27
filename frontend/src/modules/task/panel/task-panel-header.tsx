import { FunnelIcon, PlusIcon, SquareCheckBigIcon } from 'lucide-react';
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
import { formatSectionLabel, isPrimarySection, makePanelKey, panelHostsDraft } from '~/modules/task/helpers/board-helpers';
import { createTaskFormId, type NewTaskFormValues, newTaskFormIsDirty, toggleCreateTaskForm } from '~/modules/task/helpers/create-task';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import { newTaskButtonClass, panelHandleClass } from '~/modules/task/task-styles';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { cn } from '~/utils/cn';

interface PanelLeadingProps extends Pick<BoardPanelProps, 'project' | 'sectionFilters'> {
  showProject: boolean;
  isPrimary: boolean;
  isCollapsed: boolean;
}

function PanelLeading({ project, sectionFilters, showProject, isPrimary, isCollapsed }: PanelLeadingProps) {
  const { t } = useTranslation();

  const projectAvatar = <EntityAvatar id={project.id} type="project" name={project.name} url={project.thumbnailUrl} />;

  if (showProject && isPrimary) {
    return (
      <PanelDragHandleButton
        name={project.name}
        fallbackLabel={project.name}
        icon={projectAvatar}
        preview={<EntityChip type="project" id={project.id} name={project.name} url={project.thumbnailUrl} />}
        className={cn(panelHandleClass, 'truncate no-underline', isCollapsed ? 'w-full justify-center' : 'pr-2')}
      >
        {!isCollapsed && <div className="truncate font-semibold leading-6">{project.name}</div>}
      </PanelDragHandleButton>
    );
  }

  if (sectionFilters) {
    const sectionName = formatSectionLabel(sectionFilters);

    if (showProject) {
      const splitName = `${project.name}: ${sectionName}`;
      return (
        <PanelDragHandleButton
          name={splitName}
          icon={
            <div className="relative shrink-0">
              {projectAvatar}
              <div className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border bg-background">
                <FunnelIcon className="size-2.5" />
              </div>
            </div>
          }
          preview={
            <EntityChip type="project" id={project.id} name={project.name} url={project.thumbnailUrl}>
              {splitName}
            </EntityChip>
          }
          className={cn(panelHandleClass, 'min-w-0', isCollapsed && 'w-full justify-center')}
        >
          {!isCollapsed && (
            <div className="truncate font-semibold leading-6">
              <span className="pr-1 text-sm">{sectionName}</span>
            </div>
          )}
        </PanelDragHandleButton>
      );
    }

    return (
      <PanelDragHandleButton
        name={sectionName}
        fallbackLabel={sectionName}
        icon={
          <div className="flex min-w-8 justify-center">
            <FunnelIcon className="size-4 shrink-0" />
          </div>
        }
        className={cn(panelHandleClass, 'min-h-8 truncate', isCollapsed ? 'w-full justify-center' : 'pr-2')}
      >
        {!isCollapsed && <div className="truncate font-semibold leading-6">{sectionName}</div>}
      </PanelDragHandleButton>
    );
  }

  // Unsplit panel in a project view: the project identity lives in the page header
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

export function TaskPanelHeader({
  project,
  sectionFilters,
  publicView,
  showProject,
}: Pick<BoardPanelProps, 'project' | 'sectionFilters' | 'publicView' | 'showProject'>) {
  const { t } = useTranslation();

  const isInWorkspace = useIsWorkspaceRoute();

  const viewSections = useProjectViewSections(project.id);
  const panelId = sectionFilters ? makePanelKey(project.id, sectionFilters) : project.id;
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  const formId = createTaskFormId(project.id);
  const hasDraft = useDraftStore((state) => {
    const storedForm = state.getForm<NewTaskFormValues>(formId);
    return !!storedForm && newTaskFormIsDirty(storedForm);
  });

  const isPrimary = isPrimarySection(viewSections, sectionFilters);

  const isReadOnly = useIsProjectReadOnly(project.id);
  const isCreateFormOpen = useTaskInteractionStore((state) => state.draftTasks[project.id] !== undefined);
  const openDraftStatus = useTaskInteractionStore((state) => state.draftTasks[project.id]?.status);
  const storedDraftStatus = useDraftStore((state) => state.getForm<NewTaskFormValues>(formId)?.status);

  // Split view: only the panel the form opens in (or has moved to) offers the toggle
  const hostsCreateButton = panelHostsDraft(viewSections, project.id, panelId, openDraftStatus ?? storedDraftStatus ?? TaskStatus.Unstarted);

  const toggleCreateForm = () => toggleCreateTaskForm(project);

  const actionsSlot = !isCollapsed ? (
    <>
      {/* A public board is read-only for every visitor, so the badge would tell nobody anything */}
      {isReadOnly && !publicView && (
        <Badge variant="plain" className="font-normal text-xs opacity-75">
          {t('c:read_only')}
        </Badge>
      )}
      {!publicView && isInWorkspace && isPrimary && <ProjectActionsMenu project={project} className="h-8 px-2" />}
      {!isReadOnly && hostsCreateButton && (
        <Button data-form-dirty={hasDraft} variant="plain" size="xs" className={newTaskButtonClass} onClick={toggleCreateForm}>
          <Badge className="absolute -top-1 -right-1 z-100 in-data-[form-dirty=false]:hidden size-2 p-0" />
          <PlusIcon className={cn('size-4.5 transition-transform duration-200', isCreateFormOpen && 'rotate-45')} />
          <span>{t('c:task')}</span>
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <BoardPanelHeader
      className="bg-card"
      leading={
        <PanelLeading
          project={project}
          sectionFilters={sectionFilters}
          showProject={isInWorkspace || !!showProject}
          isPrimary={isPrimary}
          isCollapsed={!!isCollapsed}
        />
      }
      actions={actionsSlot}
      isCollapsed={!!isCollapsed}
    />
  );
}
