import { useSearch } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useScrollVisibility } from '~/hooks/use-scroll-visibility';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { FloatingNavButton } from '~/modules/navigation/floating-nav/button';
import type { EnrichedProject } from '~/modules/project/types';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { type SectionsValue, useProjectPanelPrefs } from '~/modules/task/board/task-board-store';
import { makePanelKey, prepareBoardTasks } from '~/modules/task/helpers/board-helpers';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { isExcludedBySearch, matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { usePanelDropTarget } from '~/modules/task/hooks/use-panel-drop-target';
import { openCreateTaskDialog } from '~/modules/task/mobile-create-task-dialog';
import { TaskPanelCollapsed } from '~/modules/task/panel/task-panel-collapsed';
import { TaskPanelContent } from '~/modules/task/panel/task-panel-content';
import { TaskPanelHeader } from '~/modules/task/panel/task-panel-header';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task, TaskCounts } from '~/modules/task/types';

export interface BoardPanelProps {
  fetchedTasks: Task[];
  project: EnrichedProject;
  projectFetchedCount: number;
  publicView?: boolean;
  sectionFilters?: SectionsValue;
  /** Names the project in the panel header, for a board of several projects outside a workspace. */
  showProject?: boolean;
  windowScroll?: boolean;
}

export const BoardPanel = memo(function BoardPanel({
  fetchedTasks,
  project,
  projectFetchedCount,
  publicView,
  sectionFilters,
  showProject,
  windowScroll,
}: BoardPanelProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const isReadOnly = useIsProjectReadOnly(project.id);
  const q = useSearch({ strict: false, select: (search) => search.q });
  const matchMode = useSearch({ strict: false, select: (search) => search.matchMode });

  const { isVisible: showFab } = useScrollVisibility(isMobile);

  const { expandIced, expandAccepted } = useProjectPanelPrefs(project.id);
  const panelId = sectionFilters ? makePanelKey(project.id, sectionFilters) : project.id;
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  // The open create-form draft always stays visible; a highlight search keeps every task but the excluded ones
  const matchedTasks = fetchedTasks.filter((task) => isDraftTask(task) || matchesBoardSearch({ q, matchMode }, task));
  const matchedIds = new Set(matchedTasks.map(({ id }) => id));
  const filteredTasks = parseSearchQuery(q).highlight
    ? fetchedTasks
        .filter((task) => !isExcludedBySearch(q, task))
        .map((task) => (matchedIds.has(task.id) ? { ...task, isMatchingSearch: true } : task))
    : matchedTasks;

  const tasks = prepareBoardTasks(filteredTasks, expandAccepted, expandIced);

  // The drop target wraps header and list, so its ring frames the whole panel, expanded or collapsed; mobile uses a different layout
  const panelRef = useRef<HTMLDivElement>(null);
  const { highlightProject } = usePanelDropTarget({ panelRef, projectId: project.id, tasks });

  const acceptedCount = filteredTasks.filter(({ status }) => status === TaskStatus.Accepted).length;
  const icedCount = filteredTasks.filter(({ status }) => status === TaskStatus.Iced).length;

  // Accepted tasks beyond the cut-off: the project's task total minus those the board fetched
  const totalTasks = project.included?.counts?.entities?.task ?? 0;
  const hiddenAccepted = Math.max(0, totalTasks - projectFetchedCount);

  const showAccepted = !sectionFilters || sectionFilters.status.includes(TaskStatus.Accepted);
  const showIced = !sectionFilters || sectionFilters.status.includes(TaskStatus.Iced);

  const counts = {
    total: filteredTasks.length,
    acceptedCutOff: hiddenAccepted,
    showAccepted,
    showIced,
    accepted: showAccepted ? acceptedCount : 0,
    iced: showIced ? icedCount : 0,
  } satisfies TaskCounts;

  return (
    <div data-search={!!q} className="group/panel h-full">
      {isMobile ? (
        <div ref={panelRef} data-highlighted={highlightProject || undefined} className="group/paneldrop flex h-full flex-col">
          <TaskPanelContent project={project} panelId={panelId} tasks={tasks} counts={counts} />
          {!isReadOnly && (
            <FloatingNavButton
              id="create-task"
              icon={PlusIcon}
              onClick={() => openCreateTaskDialog(project.id, project.organizationId)}
              ariaLabel={t('c:create_resource', { resource: t('c:task').toLowerCase() })}
              className={showFab ? 'opacity-100' : 'pointer-events-none translate-y-16 scale-50 opacity-0'}
            />
          )}
        </div>
      ) : (
        <div ref={panelRef} className="relative flex h-full flex-col">
          <TaskPanelHeader project={project} sectionFilters={sectionFilters} publicView={publicView} showProject={showProject} />
          <div className="flex min-h-0 flex-1 flex-col">
            <BoardPanelContent isCollapsed={!!isCollapsed} collapsedContent={<TaskPanelCollapsed counts={counts} />}>
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
