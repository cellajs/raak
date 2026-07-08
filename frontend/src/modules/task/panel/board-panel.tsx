import { Plus } from 'lucide-react';
import { memo, useMemo, useRef } from 'react';
import type { z } from 'zod';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useScrollVisibility } from '~/hooks/use-scroll-visibility';
import { useSearchParams } from '~/hooks/use-search-params';
import { BoardPanelContent } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import type { EnrichedProject } from '~/modules/project/types';
import { defaultPanelPrefs, type SectionsValue, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { makePanelKey, prepareBoardTasks } from '~/modules/task/helpers/board-helpers';
import { createTaskAction } from '~/modules/task/helpers/create-task-action';
import { searchFilterFunction } from '~/modules/task/helpers/search-filter';
import { usePanelDropTarget } from '~/modules/task/hooks/use-panel-drop-target';
import { TaskPanelCollapsed } from '~/modules/task/panel/panel-collapsed';
import { TaskPanelContent } from '~/modules/task/panel/panel-content';
import { TaskPanelHeader } from '~/modules/task/panel/panel-header';
import type { tasksBoardSearchSchema } from '~/modules/task/search-params-schemas';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task, TaskCounts } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';

export interface BoardPanelProps {
  fetchedTasks: Task[];
  project: EnrichedProject;
  projectFetchedCount: number;
  sectionFilters?: SectionsValue;
  windowScroll?: boolean;
}

type BoardSearchProps = z.infer<typeof tasksBoardSearchSchema>;

export const BoardPanel = memo(function BoardPanel({
  fetchedTasks,
  project,
  projectFetchedCount,
  sectionFilters,
  windowScroll,
}: BoardPanelProps) {
  const isMobile = useBreakpointBelow('sm');
  const { search } = useSearchParams<BoardSearchProps>({});
  const boardId = useBoardStore((state) => state.activeBoardId)!;
  const boardType = useBoardStore((state) => state.activeBoardType)!;

  // Mobile FAB: auto-hide on scroll, show draft badge
  const { isVisible: showFab } = useScrollVisibility(isMobile);
  const hasDraft = useDraftStore((state) => !!state.dirtyForms[`create-task-${project.id}`]);

  const { expandIced, expandAccepted } = useTaskBoardStore(
    (state) => state.panelData[boardId]?.[project.id]?.prefs || defaultPanelPrefs,
  );
  const isCollapsed = useBoardStore((state) => {
    const panelId = sectionFilters ? makePanelKey(project.id, sectionFilters) : project.id;
    return state.panelCollapseState[panelId];
  });

  // Filter tasks based on search and filters
  const filteredTasks = useMemo(() => {
    const matchedTasks = fetchedTasks.filter((task) => searchFilterFunction(search, task));

    const isHighlightMode = search.q?.trim().startsWith('=') && search.q?.trim().replace('=', '').length;
    return isHighlightMode
      ? fetchedTasks.map((task) =>
          matchedTasks.some(({ id }) => id === task.id) ? { ...task, isMatchingSearch: true } : task,
        )
      : matchedTasks;
  }, [fetchedTasks, search.q, search.matchMode]);

  // Sort tasks and filter out accepted and iced based of config
  const tasks = useMemo(
    () => prepareBoardTasks(filteredTasks, expandAccepted, expandIced),
    [filteredTasks, expandIced, expandAccepted],
  );

  // Panel-level drop target — registered on the outer wrapper so it works in
  // both expanded and collapsed states (mobile uses a different layout).
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { highlightProject } = usePanelDropTarget({ panelRef, projectId: project.id, tasks });

  const counts = useMemo(() => {
    const { accepted, iced } = filteredTasks.reduce(
      (acc, { status }) => {
        if (status === TaskStatus.Accepted) acc.accepted++;
        if (status === TaskStatus.Iced) acc.iced++;
        return acc;
      },
      { accepted: 0, iced: 0 },
    );

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
    <div data-search={!!search.q} className="group/panel h-full">
      {isMobile ? (
        <div
          ref={panelRef}
          data-highlighted={highlightProject ? 'true' : undefined}
          className="group/paneldrop flex h-full flex-col"
        >
          <TaskPanelContent project={project} tasks={tasks} counts={counts} />
          <Button
            size="icon"
            variant="secondary"
            onClick={() => createTaskAction(project.id, project.organizationId)}
            aria-label="Create task"
            className={`fixed right-4 bottom-4 z-105 h-14 w-14 transform rounded-full bg-secondary shadow-xl transition-all duration-300 ease-in-out hover:bg-secondary active:scale-95 ${
              showFab ? 'opacity-100' : 'pointer-events-none -bottom-12 scale-50 opacity-0'
            }`}
          >
            <Plus size={24} strokeWidth={1.5} />
            {hasDraft && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                !
              </span>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          {(boardType !== 'project' || sectionFilters) && (
            <TaskPanelHeader project={project} sectionFilters={sectionFilters} />
          )}
          <div
            ref={panelRef}
            data-highlighted={highlightProject ? 'true' : undefined}
            className="group/paneldrop flex min-h-0 flex-1 flex-col"
          >
            <BoardPanelContent isCollapsed={!!isCollapsed} collapsedContent={<TaskPanelCollapsed counts={counts} />}>
              <TaskPanelContent project={project} tasks={tasks} counts={counts} windowScroll={windowScroll} />
            </BoardPanelContent>
          </div>
        </div>
      )}
    </div>
  );
});
