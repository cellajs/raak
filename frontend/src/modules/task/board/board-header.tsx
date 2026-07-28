import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableCount } from '~/modules/common/data-table/table-count';
import { FocusView } from '~/modules/common/focus-view';
import { LabelSelectedButtons } from '~/modules/label/label-selected-buttons';
import { DisplayOptions } from '~/modules/task/board/display-options';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { BoardSearch } from '~/modules/task/board-search';
import { useTasksTotal } from '~/modules/task/hooks/use-tasks-total';
import { deriveTasksQueryParams } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import { taskBarClass } from '~/modules/task/task-styles';
import { WorkspaceActionButtons } from '~/modules/workspace/header/action-buttons';
import { cn } from '~/utils/cn';

/**
 * Header component for the task board, including search, task count and action buttons.
 * Used for both project boards and workspace boards, with conditional rendering based on context.
 */
export function BoardHeader({
  projects,
  workspace,
  publicView,
}: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) {
  const { t, i18n } = useTranslation();
  const isInWorkspace = !!workspace;

  const {
    search: { q: searchQuery = '' },
  } = useSearchParams<{ q?: string }>({});

  // No scope to derive params from in a public view or while a non-workspace board has no projects yet
  const queryParams =
    publicView || (!workspace && !projects[0]) ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const total = useTasksTotal('board', queryParams);
  const selectedTaskIds = useTaskInteractionStore((s) => s.selectedTaskIds);
  const setSelectedTaskIds = useTaskInteractionStore((s) => s.setSelectedTaskIds);
  const selectedLabelIds = useTaskInteractionStore((s) => s.selectedLabelIds);
  const setSelectedLabelIds = useTaskInteractionStore((s) => s.setSelectedLabelIds);

  const [searchFocused, setSearchFocused] = useState(false);

  const toggleSearchFocus = () => setSearchFocused((prev) => !prev);
  const clearSelection = () => {
    setSelectedTaskIds([]);
    setSelectedLabelIds([]);
  };

  return (
    <div data-search-focused={searchFocused} className={cn('group/boardHeader', taskBarClass)}>
      {/* Floating bottom action bars; task and label selection are mutually exclusive */}
      <TaskSelectedButtons
        selectedTaskIds={selectedTaskIds}
        clearSelection={clearSelection}
        organizationId={queryParams?.organizationId ?? ''}
        tenantId={queryParams?.tenantId ?? ''}
      />
      <LabelSelectedButtons
        selectedLabelIds={selectedLabelIds}
        clearSelection={clearSelection}
        organizationId={queryParams?.organizationId ?? ''}
        tenantId={queryParams?.tenantId ?? ''}
      />

      <BoardSearch toggleFocus={toggleSearchFocus}>
        {' '}
        {typeof total === 'number' && searchQuery && (
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <span>{new Intl.NumberFormat(i18n.language).format(total)}</span>
            <span>{t('c:found')}</span>
          </div>
        )}
      </BoardSearch>

      {!searchQuery && !searchFocused && <TableCount count={total} label="c:task" className="mr-3" />}

      {isInWorkspace && <WorkspaceActionButtons />}

      <DisplayOptions className="empty:hidden max-sm:hidden" />

      <FocusView iconOnly />
    </div>
  );
}
