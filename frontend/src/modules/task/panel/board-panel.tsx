import { useSearch } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { memo, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useScrollVisibility } from '~/hooks/use-scroll-visibility';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { FloatingNavButton } from '~/modules/navigation/floating-nav/button';
import type { EnrichedProject } from '~/modules/project/types';
import { type SectionsValue, useProjectPanelPrefs } from '~/modules/task/board/task-board-store';
import { makePanelKey, prepareBoardTasks } from '~/modules/task/helpers/board-helpers';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { matchesBoardSearch } from '~/modules/task/helpers/search-filter';
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
  windowScroll?: boolean;
}

export const BoardPanel = memo(function BoardPanel({
  fetchedTasks,
  project,
  projectFetchedCount,
  publicView,
  sectionFilters,
  windowScroll,
}: BoardPanelProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const q = useSearch({ strict: false, select: (search) => search.q });
  const matchMode = useSearch({ strict: false, select: (search) => search.matchMode });

  const { isVisible: showFab } = useScrollVisibility(isMobile);

  const { expandIced, expandAccepted } = useProjectPanelPrefs(project.id);
  const panelId = sectionFilters ? makePanelKey(project.id, sectionFilters) : project.id;
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  // Filter tasks based on search and filters; the open create-form draft always stays visible
  const filteredTasks = useMemo(() => {
    const matchedTasks = fetchedTasks.filter((task) => isDraftTask(task) || matchesBoardSearch({ q, matchMode }, task));

    const isHighlightMode = parseSearchQuery(q).highlight;
    if (!isHighlightMode) return matchedTasks;

    const matchedIds = new Set(matchedTasks.map(({ id }) => id));
    return fetchedTasks.map((task) => (matchedIds.has(task.id) ? { ...task, isMatchingSearch: true } : task));
  }, [fetchedTasks, q, matchMode]);

  // Sort tasks and filter out accepted and iced based of config
  const tasks = useMemo(() => prepareBoardTasks(filteredTasks, expandAccepted, expandIced), [filteredTasks, expandIced, expandAccepted]);

  // Panel-level drop target registered on the outer wrapper so it works in
  // both expanded and collapsed states (mobile uses a different layout).
  const panelRef = useRef<HTMLDivElement>(null);
  const { highlightProject } = usePanelDropTarget({ panelRef, projectId: project.id, tasks });

  const counts = useMemo(() => {
    const accepted = filteredTasks.filter(({ status }) => status === TaskStatus.Accepted).length;
    const iced = filteredTasks.filter(({ status }) => status === TaskStatus.Iced).length;

    // Derive hidden accepted count: total tasks in DB minus tasks the board fetched for this project
    const totalTasks = project.included?.counts?.entities?.task ?? 0;
    const hiddenAccepted = Math.max(0, totalTasks - projectFetchedCount);

    const showAccepted = !sectionFilters || sectionFilters.status.includes(TaskStatus.Accepted);
    const showIced = !sectionFilters || sectionFilters.status.includes(TaskStatus.Iced);

    return {
      total: filteredTasks.length,
      acceptedCutOff: hiddenAccepted,
      showAccepted,
      showIced,
      accepted: showAccepted ? accepted : 0,
      iced: showIced ? iced : 0,
    } satisfies TaskCounts;
  }, [filteredTasks, project.included?.counts?.entities?.task, projectFetchedCount, sectionFilters]);

  return (
    <div data-search={!!q} className="group/panel h-full">
      {isMobile ? (
        <div ref={panelRef} data-highlighted={highlightProject || undefined} className="group/paneldrop flex h-full flex-col">
          <TaskPanelContent project={project} panelId={panelId} tasks={tasks} counts={counts} />
          <FloatingNavButton
            id="create-task"
            icon={PlusIcon}
            onClick={() => openCreateTaskDialog(project.id, project.organizationId)}
            ariaLabel={t('c:create_resource', { resource: t('c:task').toLowerCase() })}
            className={showFab ? 'opacity-100' : 'pointer-events-none translate-y-16 scale-50 opacity-0'}
          />
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <TaskPanelHeader project={project} sectionFilters={sectionFilters} publicView={publicView} />
          <div ref={panelRef} data-highlighted={highlightProject || undefined} className="group/paneldrop flex min-h-0 flex-1 flex-col">
            <BoardPanelContent isCollapsed={!!isCollapsed} collapsedContent={<TaskPanelCollapsed counts={counts} />}>
              <TaskPanelContent project={project} panelId={panelId} tasks={tasks} counts={counts} windowScroll={windowScroll} />
            </BoardPanelContent>
          </div>
        </div>
      )}
    </div>
  );
});
