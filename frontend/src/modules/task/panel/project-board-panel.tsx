import { useSuspenseQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useBoardStore } from '~/modules/common/board/board-store';
import type { EnrichedProject } from '~/modules/project/types';
import { type SectionsValue, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { makePanelKey, resolveDraftHostSection } from '~/modules/task/helpers/board-helpers';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { BoardPanel } from '~/modules/task/panel/board-panel';
import { publicTasksBoardQueryOptions } from '~/modules/task/public-query';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { Task } from '~/modules/task/types';
import { stableArray } from '~/utils/stable-array';

interface ProjectBoardPanelProps {
  project: EnrichedProject;
  publicView?: boolean;
  sectionFilters?: SectionsValue;
  windowScroll?: boolean;
}

/**
 * Fetches canonical task data for its project and merges draft tasks from Zustand.
 * Stabilises per-panel task arrays so panels whose tasks didn't change
 * keep the same reference and skip re-rendering entirely.
 */
export function ProjectBoardPanel({ project, publicView, sectionFilters, windowScroll }: ProjectBoardPanelProps) {
  const queryOpts = publicView
    ? publicTasksBoardQueryOptions(project.id)
    : tasksCanonicalOptions({
        organizationId: project.organizationId,
        tenantId: project.tenantId,
        projectId: project.id,
      });

  // Both option variants share the same data shape; widen key type via assertion
  const { data } = useSuspenseQuery(queryOpts as ReturnType<typeof tasksCanonicalOptions>);

  const draftTask = useTaskInteractionStore((s) => s.draftTasks[project.id]);
  const boardId = useBoardStore((s) => s.activeBoardId)!;
  const viewSections = useTaskBoardStore((s) => s.panelData[boardId]?.[project.id]?.viewSections);

  // The open create-form draft renders in exactly one panel and bypasses section filtering,
  // so a lit "+ Task" badge always corresponds to a visible form somewhere on the board.
  const hostSection = draftTask ? resolveDraftHostSection(viewSections, draftTask.status) : null;
  const hostsDraft =
    !!draftTask &&
    (sectionFilters
      ? !!hostSection && makePanelKey(project.id, hostSection) === makePanelKey(project.id, sectionFilters)
      : true);

  const projectTasksRef = useRef<Task[]>([]);
  const panelTasksRef = useRef<Task[]>([]);

  const rawProjectTasks: Task[] = hostsDraft ? [...data.items, draftTask] : data.items;
  const projectTasks = stableArray(projectTasksRef.current, rawProjectTasks);
  projectTasksRef.current = projectTasks;

  const rawPanelTasks = sectionFilters
    ? projectTasks.filter(
        (task) =>
          isDraftTask(task) ||
          Object.entries(sectionFilters).every(([key, value]) => {
            const taskValue = task[key as keyof SectionsValue];
            return value.includes(taskValue);
          }),
      )
    : projectTasks;
  const panelTasks = stableArray(panelTasksRef.current, rawPanelTasks);
  panelTasksRef.current = panelTasks;

  return (
    <BoardPanel
      fetchedTasks={panelTasks}
      project={project}
      projectFetchedCount={data.items.length}
      publicView={publicView}
      sectionFilters={sectionFilters}
      windowScroll={windowScroll}
    />
  );
}
