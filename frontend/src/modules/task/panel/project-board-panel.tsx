import { useSuspenseQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import type { EnrichedProject } from '~/modules/project/types';
import { type SectionsValue, useProjectViewSections } from '~/modules/task/board/task-board-store';
import { inSections, makePanelKey, panelHostsDraft } from '~/modules/task/helpers/board-helpers';
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
    : tasksCanonicalOptions({ organizationId: project.organizationId, tenantId: project.tenantId, projectId: project.id });

  // Both option variants share the same data shape; widen key type via assertion
  const { data } = useSuspenseQuery(queryOpts as ReturnType<typeof tasksCanonicalOptions>);

  const isMobile = useBreakpointBelow('sm');
  const draftTask = useTaskInteractionStore((s) => s.draftTasks[project.id]);
  const viewSections = useProjectViewSections(project.id);

  // The open create-form draft renders in exactly one panel and bypasses section filtering,
  // so a lit "+ Task" badge always corresponds to a visible form somewhere on the board.
  // Mobile creates through a dialog, so no draft row enters its list.
  const hostsDraft =
    !isMobile &&
    !!draftTask &&
    (!sectionFilters || panelHostsDraft(viewSections, project.id, makePanelKey(project.id, sectionFilters), draftTask.status));

  const projectTasksRef = useRef<Task[]>([]);
  const panelTasksRef = useRef<Task[]>([]);

  const rawProjectTasks: Task[] = hostsDraft ? [...data.items, draftTask] : data.items;
  const projectTasks = stableArray(projectTasksRef.current, rawProjectTasks);
  projectTasksRef.current = projectTasks;

  const rawPanelTasks = sectionFilters ? projectTasks.filter((task) => isDraftTask(task) || inSections(task, sectionFilters)) : projectTasks;
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
