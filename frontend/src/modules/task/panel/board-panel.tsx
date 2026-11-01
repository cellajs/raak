import { PlusIcon } from 'lucide-react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useScrollVisibility } from '~/hooks/use-scroll-visibility';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { FloatingNavButton } from '~/modules/navigation/floating-nav/button';
import type { EnrichedProject } from '~/modules/project/types';
import { useProjectPanelPrefs } from '~/modules/task/board/task-board-store';
import { foldsStatus, prepareBoardTasks, projectPanelName } from '~/modules/task/helpers/board-helpers';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { isBoardSearchActive, matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { usePanelDropTarget } from '~/modules/task/hooks/use-panel-drop-target';
import { openCreateTaskDialog } from '~/modules/task/mobile-create-task-dialog';
import { TaskPanelCollapsed } from '~/modules/task/panel/task-panel-collapsed';
import { TaskPanelContent } from '~/modules/task/panel/task-panel-content';
import { TaskPanelHeader } from '~/modules/task/panel/task-panel-header';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task, TaskCounts } from '~/modules/task/types';
import { cn } from '~/utils/cn';

export interface BoardPanelProps {
  fetchedTasks: Task[];
  project: EnrichedProject;
  projectFetchedCount: number;
  publicView?: boolean;
  /** Its id on the board; a status panel has its own, the project's panel the project's. */
  panelId: string;
  /** The statuses it lists; all of them when absent. */
  statuses?: TaskStatus[];
  windowScroll?: boolean;
}

export const BoardPanel = memo(function BoardPanel({
  fetchedTasks,
  project,
  projectFetchedCount,
  publicView,
  panelId,
  statuses,
  windowScroll,
}: BoardPanelProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const search = useBoardSearch();

  const { isVisible: showFab } = useScrollVisibility(isMobile);

  const { expandIced, expandAccepted } = useProjectPanelPrefs(project.id);
  const isCollapsed = useBoardStore((state) => !!state.panelCollapseState[panelId]);

  const filteredTasks = fetchedTasks.filter((task) => matchesBoardSearch(search, task));
  const isOneStatus = statuses?.length === 1;
  // Filtering on a folded status shows its tasks; a panel of one status has nothing to fold them away from
  const tasks = prepareBoardTasks(
    filteredTasks,
    isOneStatus || expandAccepted || search.statuses.includes('accepted'),
    isOneStatus || expandIced || search.statuses.includes('iced'),
  );

  // The drop target wraps header and list, so its ring frames the whole panel, expanded or collapsed; mobile uses a different layout
  const panelRef = useRef<HTMLDivElement>(null);
  const { highlightProject } = usePanelDropTarget({ panelRef, projectId: project.id, tasks, statuses });

  const acceptedCount = filteredTasks.filter(({ status }) => status === TaskStatus.Accepted).length;
  const icedCount = filteredTasks.filter(({ status }) => status === TaskStatus.Iced).length;

  // Accepted tasks beyond the cut-off: the project's task total minus those the board fetched
  const totalTasks = project.included?.counts?.entities?.task ?? 0;
  const hiddenAccepted = Math.max(0, totalTasks - projectFetchedCount);

  const showAccepted = foldsStatus(statuses, TaskStatus.Accepted);
  const showIced = foldsStatus(statuses, TaskStatus.Iced);

  const counts = {
    total: filteredTasks.length,
    acceptedCutOff: !statuses || statuses.includes(TaskStatus.Accepted) ? hiddenAccepted : 0,
    showAccepted,
    showIced,
    accepted: showAccepted ? acceptedCount : 0,
    iced: showIced ? icedCount : 0,
  } satisfies TaskCounts;

  return (
    <div data-search={isBoardSearchActive(search)} className="group/panel h-full">
      {isMobile ? (
        <div ref={panelRef} data-highlighted={highlightProject || undefined} className="group/paneldrop flex h-full flex-col">
          <TaskPanelContent project={project} panelId={panelId} tasks={tasks} counts={counts} />
          <FloatingNavButton
            id="create-task"
            icon={PlusIcon}
            onClick={() => openCreateTaskDialog(project.id, project.organizationId, isOneStatus ? statuses?.[0] : undefined)}
            ariaLabel={t('c:create_resource', { resource: t('c:task') })}
            className={showFab ? 'opacity-100' : 'pointer-events-none translate-y-16 scale-50 opacity-0'}
          />
        </div>
      ) : (
        <div ref={panelRef} className={cn('relative flex h-full flex-col', windowScroll && 'min-h-[80vh]')}>
          <TaskPanelHeader
            project={project}
            publicView={publicView}
            statuses={statuses}
            panelId={panelId}
            count={filteredTasks.filter((task) => !isDraftTask(task)).length}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <BoardPanelContent
              isCollapsed={isCollapsed}
              collapsedContent={<TaskPanelCollapsed panelId={panelId} name={projectPanelName(project, statuses)} counts={counts} />}
            >
              <TaskPanelContent project={project} panelId={panelId} tasks={tasks} counts={counts} windowScroll={windowScroll} />
            </BoardPanelContent>
          </div>
          {/* Above the sticky status bars (z-85), which would cover a recoloured border */}
          {highlightProject && <div aria-hidden className="pointer-events-none absolute inset-0 z-90 rounded-t-lg ring-4 ring-primary ring-inset" />}
        </div>
      )}
    </div>
  );
});
