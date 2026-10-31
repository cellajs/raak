import { FocusView } from '~/modules/common/focus-view';
import { LabelsDrawerButton } from '~/modules/label/labels-drawer';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { BoardSearchBar } from '~/modules/task/board-search';
import { sortTasksAsOnBoard } from '~/modules/task/helpers/board-helpers';
import { useTasksTotal } from '~/modules/task/hooks/use-tasks-total';
import { deriveTasksQueryParams } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import { WorkspaceActionButtons } from '~/modules/workspace/header/action-buttons';

export function BoardHeader({
  boardId,
  projects,
  workspace,
  publicView,
}: Pick<ResolvedBoardProps, 'boardId' | 'projects' | 'workspace' | 'publicView'>) {
  const isInWorkspace = !!workspace;

  // No scope to derive params from in a public view or while a non-workspace board has no projects yet
  const queryParams = publicView || (!workspace && !projects[0]) ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const total = useTasksTotal(queryParams);
  const selectedTaskIds = useTaskInteractionStore((state) => state.selectedTaskIds);
  const setSelectedTaskIds = useTaskInteractionStore((state) => state.setSelectedTaskIds);

  const clearSelection = () => setSelectedTaskIds([]);

  return (
    <>
      {!publicView && (
        <TaskSelectedButtons
          selectedTaskIds={selectedTaskIds}
          clearSelection={clearSelection}
          organizationId={queryParams?.organizationId ?? ''}
          tenantId={queryParams?.tenantId ?? ''}
          orderTasks={(tasks) => sortTasksAsOnBoard(tasks, projects)}
        />
      )}

      <BoardSearchBar
        projects={projects}
        isInWorkspace={isInWorkspace}
        publicView={publicView}
        total={total}
        controls={
          <>
            {isInWorkspace && <WorkspaceActionButtons />}
            {!isInWorkspace && !publicView && projects[0] && <ProjectActionsMenu project={projects[0]} />}
            {!publicView && projects.length > 0 && (
              <LabelsDrawerButton entity={workspace ? 'workspace' : 'project'} entityId={workspace?.id ?? boardId} />
            )}
            <DisplayOptions className="max-sm:hidden" />
            <FocusView iconOnly />
          </>
        }
      />
    </>
  );
}
