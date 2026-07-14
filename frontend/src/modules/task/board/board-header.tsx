import { BadgeIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableCount } from '~/modules/common/data-table/table-count';
import { FocusView } from '~/modules/common/focus-view';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { toggleCreateTaskForm } from '~/modules/task/helpers/create-task';
import { useReadOnlyHide } from '~/modules/task/hooks/use-read-only';
import { useTasksTotal } from '~/modules/task/hooks/use-tasks-total';
import { PanelProjectActions } from '~/modules/task/panel/panel-project-actions';
import { deriveTasksQueryParams } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskSearch } from '~/modules/task/task-search';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import { Button } from '~/modules/ui/button';
import { WorkspaceActionButtons } from '~/modules/workspace/header/action-buttons';
import { DisplayOptions } from '~/modules/workspace/header/display-options';
import { cn } from '~/utils/cn';

/**
 * Header component for the task board, including search, create button, and action buttons.
 * Used for both project boards and workspace boards, with conditional rendering based on context.
 */
export const BoardHeader = ({
  projects,
  workspace,
  publicView,
}: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) => {
  const { t, i18n } = useTranslation();
  const isInWorkspace = !!workspace;

  const {
    search: { q: searchQuery = '' },
  } = useSearchParams<{ q?: string }>({});

  // No scope to derive params from in a public view or while a non-workspace board has no projects yet
  const queryParams =
    publicView || (!workspace && !projects[0]) ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const total = useTasksTotal('board', queryParams);
  const selectedTasks = useTaskInteractionStore((s) => s.selectedTasks);
  const setSelectedTasks = useTaskInteractionStore((s) => s.setSelectedTasks);
  const isCreateFormOpen = useTaskInteractionStore((s) => s.draftTasks[projects[0]?.id] !== undefined);

  const [searchFocused, setSearchFocused] = useState(false);
  const readOnlyHide = useReadOnlyHide(projects[0]?.id);

  const toggleSearchFocus = () => setSearchFocused((prev) => !prev);
  const clearSelection = () => setSelectedTasks([]);

  const toggleCreateForm = () => toggleCreateTaskForm(projects[0]);

  return (
    <div
      data-search-focused={searchFocused}
      className="group/boardHeader z-85 flex items-center bg-background max-sm:justify-between max-sm:p-2 sm:gap-2"
    >
      {!searchFocused && (
        <TaskSelectedButtons
          selectedTasks={selectedTasks}
          clearSelection={clearSelection}
          organizationId={queryParams?.organizationId ?? ''}
          tenantId={queryParams?.tenantId ?? ''}
        />
      )}

      {!isInWorkspace && projects.length > 0 && !selectedTasks.length && (
        <Button
          variant="plain"
          data-form-dirty={false}
          className={cn('relative hidden rounded sm:inline-flex', readOnlyHide)}
          onClick={toggleCreateForm}
        >
          <BadgeIcon className="absolute -top-1 -right-1 z-100 flex in-data-[form-dirty=false]:hidden h-2 w-2 justify-center p-0" />
          <PlusIcon className={cn('size-4.5', 'transition-transform duration-200', isCreateFormOpen && 'rotate-45')} />
          <span className="ml-1">{t('c:task')}</span>
        </Button>
      )}

      <TaskSearch clearSelection={clearSelection} toggleFocus={toggleSearchFocus}>
        {' '}
        {typeof total === 'number' && searchQuery && (
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <span>{new Intl.NumberFormat(i18n.language).format(total)}</span>
            <span>{t('c:found')}</span>
          </div>
        )}
      </TaskSearch>

      {!searchQuery && !searchFocused && <TableCount count={total} label="c:task" className="mr-3" />}

      {isInWorkspace && <WorkspaceActionButtons />}
      {!publicView && !isInWorkspace && projects.length > 0 && <PanelProjectActions project={projects[0]} />}

      <DisplayOptions className="empty:hidden max-sm:hidden" />

      <FocusView iconOnly />
    </div>
  );
};
