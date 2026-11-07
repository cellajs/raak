import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { FocusView } from '~/modules/common/focus-view';
import { LabelsDrawerButton } from '~/modules/label/labels-drawer';
import { useTabProject } from '~/modules/task/board/board-hooks';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { NewTaskButton } from '~/modules/task/board/new-task-button';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import { ProjectHeaderToggle } from '~/modules/task/board/project-header-toggle';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { BoardSearchBar, type BoardSearchScope, pageSearchScope } from '~/modules/task/board-search';
import { sortTasksAsOnBoard } from '~/modules/task/helpers/board-helpers';
import { useFitBoardSearch } from '~/modules/task/hooks/use-board-search-filters';
import { useTasksTotal } from '~/modules/task/hooks/use-tasks-total';
import { deriveTasksQueryParams } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import { WorkspaceActionButtons } from '~/modules/workspace/header/action-buttons';

export function BoardHeader({ projects, workspace, publicView }: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) {
  const isMobile = useBreakpointBelow('sm');
  const tabProject = useTabProject(projects);
  const isInWorkspace = !!workspace;
  // A project page holds its project's controls in this bar; a workspace in each panel, a public view none
  const pageProject = isInWorkspace || publicView ? undefined : projects[0];
  // A phone's workspace board shows one project at a time, so its search and labels cover that one
  const scope: BoardSearchScope =
    isMobile && workspace && tabProject
      ? { entity: 'project', entityId: tabProject.id, projects: [tabProject] }
      : pageSearchScope(projects, workspace?.id);
  // Not the table's search: it reads accepted tasks past the board's cut-off, which the cached lists leave out
  useFitBoardSearch(scope.entityId, scope.projects, publicView);

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
          orderTasks={(tasks) => sortTasksAsOnBoard(tasks, projects, !!pageProject)}
        />
      )}

      <BoardSearchBar
        scope={scope}
        publicView={publicView}
        total={total}
        leading={
          pageProject && (
            <>
              <ProjectHeaderToggle project={pageProject} />
              <NewTaskButton project={pageProject} size="default" />
            </>
          )
        }
        controls={
          <>
            {isInWorkspace && <WorkspaceActionButtons />}
            {pageProject && <ProjectActionsMenu project={pageProject} />}
            {!publicView && projects.length > 0 && <LabelsDrawerButton entity={scope.entity} entityId={scope.entityId} />}
            <DisplayOptions className="max-sm:hidden" />
            {/* Focus view hides app chrome, which public pages do not have */}
            {!publicView && <FocusView iconOnly className="focus-view-toggle" />}
          </>
        }
      />
    </>
  );
}
