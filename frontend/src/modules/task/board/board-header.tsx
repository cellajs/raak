import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { TableCount } from '~/modules/common/data-table/table-count';
import { FocusView } from '~/modules/common/focus-view';
import { LabelsDrawerButton } from '~/modules/label/labels-drawer';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { BoardSearch } from '~/modules/task/board-search';
import { sortTasksAsOnBoard } from '~/modules/task/helpers/board-helpers';
import { useTasksTotal } from '~/modules/task/hooks/use-tasks-total';
import { deriveTasksQueryParams } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import { taskBarClass } from '~/modules/task/task-styles';
import { WorkspaceActionButtons } from '~/modules/workspace/header/action-buttons';
import { cn } from '~/utils/cn';

export function BoardHeader({
  boardId,
  projects,
  workspace,
  publicView,
}: Pick<ResolvedBoardProps, 'boardId' | 'projects' | 'workspace' | 'publicView'>) {
  const isInWorkspace = !!workspace;

  const searchQuery = useSearch({ strict: false, select: (search) => search.q }) ?? '';

  // No scope to derive params from in a public view or while a non-workspace board has no projects yet
  const queryParams = publicView || (!workspace && !projects[0]) ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const total = useTasksTotal(queryParams);
  const selectedTaskIds = useTaskInteractionStore((state) => state.selectedTaskIds);
  const setSelectedTaskIds = useTaskInteractionStore((state) => state.setSelectedTaskIds);

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const toggleSearchFocus = () => setIsSearchFocused((prev) => !prev);
  const clearSelection = () => setSelectedTaskIds([]);

  return (
    <div data-search-focused={isSearchFocused} className={cn('group/boardHeader', taskBarClass)}>
      {!publicView && (
        <TaskSelectedButtons
          selectedTaskIds={selectedTaskIds}
          clearSelection={clearSelection}
          organizationId={queryParams?.organizationId ?? ''}
          tenantId={queryParams?.tenantId ?? ''}
          orderTasks={(tasks) => sortTasksAsOnBoard(tasks, projects)}
        />
      )}

      <BoardSearch isInWorkspace={isInWorkspace} toggleFocus={toggleSearchFocus} total={total} />

      {!searchQuery && !isSearchFocused && <TableCount count={total} label="c:task" className="mr-3 max-sm:hidden" />}

      {isInWorkspace && <WorkspaceActionButtons />}
      {!isInWorkspace && !publicView && projects[0] && (
        <ProjectActionsMenu
          project={projects[0]}
          className={cn('max-sm:group-data-[search-focused=true]/boardHeader:hidden', searchQuery && 'max-sm:hidden')}
        />
      )}

      {!publicView && projects.length > 0 && <LabelsDrawerButton entity={workspace ? 'workspace' : 'project'} entityId={workspace?.id ?? boardId} />}

      <DisplayOptions className="max-sm:hidden" />

      <FocusView iconOnly />
    </div>
  );
}
