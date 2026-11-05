import { PlusIcon } from 'lucide-react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { FloatingAction } from '~/modules/navigation/floating-nav/floating-action';
import type { EnrichedProject } from '~/modules/project/types';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { useProjectPanelPrefs } from '~/modules/task/board/task-board-store';
import { listsEveryStatus, prepareBoardTasks, projectPageEmptyTitle } from '~/modules/task/helpers/board-helpers';
import { isBoardSearchActive, matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { usePanelDropTarget } from '~/modules/task/hooks/use-panel-drop-target';
import { openCreateTaskDialog } from '~/modules/task/mobile-create-task-dialog';
import { TaskPanelCollapsed } from '~/modules/task/panel/task-panel-collapsed';
import { TaskPanelContent } from '~/modules/task/panel/task-panel-content';
import { TaskPanelHeader } from '~/modules/task/panel/task-panel-header';
import { TaskStatus } from '~/modules/task/task-properties';
import type { ProjectPageGroup, Task, TaskCounts } from '~/modules/task/types';
import { WorkspaceArrivalBalloon } from '~/modules/workspace/workspace-arrival-balloon';
import { cn } from '~/utils/cn';

export interface BoardPanelProps {
  fetchedTasks: Task[];
  project: EnrichedProject;
  projectFetchedCount: number;
  publicView?: boolean;
  /** Its id on the board: the project's, or on a project page its group's. */
  panelId: string;
  /** The statuses it lists; all of them when absent. */
  statuses?: TaskStatus[];
  group?: ProjectPageGroup;
  windowScroll?: boolean;
}

export const BoardPanel = memo(function BoardPanel({
  fetchedTasks,
  project,
  projectFetchedCount,
  publicView,
  panelId,
  statuses,
  group,
  windowScroll,
}: BoardPanelProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const search = useBoardSearch();
  const isReadOnly = useIsProjectReadOnly(project.id);

  const { expandIced, expandAccepted } = useProjectPanelPrefs(project.id);
  const isCollapsed = useBoardStore((state) => !!state.panelCollapseState[panelId]);

  const filteredTasks = fetchedTasks.filter((task) => matchesBoardSearch(search, task));
  const folds = listsEveryStatus(statuses);
  // Filtering on a folded status shows its tasks; a panel without bars has nothing to fold them away from
  const tasks = prepareBoardTasks(
    filteredTasks,
    !folds || expandAccepted || search.statuses.includes('accepted'),
    !folds || expandIced || search.statuses.includes('iced'),
  );

  // The drop target wraps header and list, so its ring frames the whole panel, expanded or collapsed; mobile uses a different layout
  const panelRef = useRef<HTMLDivElement>(null);
  const { highlightProject } = usePanelDropTarget({ panelRef, projectId: project.id, tasks, statuses });

  const acceptedCount = filteredTasks.filter(({ status }) => status === TaskStatus.Accepted).length;
  const icedCount = filteredTasks.filter(({ status }) => status === TaskStatus.Iced).length;

  // Accepted tasks beyond the cut-off: the project's task total minus those the board fetched
  const totalTasks = project.included?.counts?.entities?.task ?? 0;
  const hiddenAccepted = Math.max(0, totalTasks - projectFetchedCount);

  // A project without any task gets the full placeholder in To do; another empty panel only says what it would hold
  const projectHasTasks = projectFetchedCount > 0 || totalTasks > 0;
  const emptyTitle = group && (group !== 'to_do' || projectHasTasks) ? projectPageEmptyTitle(group) : undefined;

  const counts = {
    total: filteredTasks.length,
    // A status filter without accepted rules out the older accepted tasks too, though the board never fetched them
    acceptedCutOff:
      (!statuses || statuses.includes(TaskStatus.Accepted)) && (!search.statuses.length || search.statuses.includes('accepted')) ? hiddenAccepted : 0,
    showAccepted: folds,
    showIced: folds,
    accepted: folds ? acceptedCount : 0,
    iced: folds ? icedCount : 0,
  } satisfies TaskCounts;

  return (
    <div data-search={isBoardSearchActive(search)} className="group/panel h-full">
      {isMobile ? (
        <div ref={panelRef} data-highlighted={highlightProject || undefined} className="group/paneldrop flex h-full flex-col">
          <TaskPanelContent project={project} panelId={panelId} tasks={tasks} counts={counts} />
          {!isReadOnly && (
            <FloatingAction
              icon={PlusIcon}
              label={t('c:create_resource', { resource: t('c:task') })}
              onClick={(triggerRef) =>
                openCreateTaskDialog(project.id, project.organizationId, statuses?.length === 1 ? statuses[0] : undefined, triggerRef)
              }
            />
          )}
          <WorkspaceArrivalBalloon project={project} />
        </div>
      ) : (
        <div
          ref={panelRef} // The header pins to the window, and the bars and card headers below read this to pin under it
          className={cn('relative flex h-full flex-col', windowScroll && 'min-h-[80vh] [--sticky-stack-nav:3.25rem]')}
        >
          <TaskPanelHeader project={project} publicView={publicView} group={group} panelId={panelId} windowScroll={windowScroll} />
          <WorkspaceArrivalBalloon project={project} />
          <div className="flex min-h-0 flex-1 flex-col">
            <BoardPanelContent
              isCollapsed={isCollapsed}
              collapsedContent={<TaskPanelCollapsed panelId={panelId} project={project} group={group} counts={counts} windowScroll={windowScroll} />}
            >
              <TaskPanelContent
                project={project}
                panelId={panelId}
                emptyTitle={emptyTitle}
                tasks={tasks}
                counts={counts}
                windowScroll={windowScroll}
              />
            </BoardPanelContent>
          </div>
          {/* Above the sticky status bars, which would cover a recoloured border */}
          {highlightProject && <div aria-hidden className="pointer-events-none absolute inset-0 z-90 rounded-t-lg ring-4 ring-primary ring-inset" />}
        </div>
      )}
    </div>
  );
});
