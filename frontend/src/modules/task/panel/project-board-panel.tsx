import { useSuspenseQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import type { EnrichedProject } from '~/modules/project/types';
import { BoardPanel } from '~/modules/task/panel/board-panel';
import { publicTasksBoardQueryOptions } from '~/modules/task/public-query';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { stableArray } from '~/utils/stable-array';

interface ProjectBoardPanelProps {
  project: EnrichedProject;
  publicView?: boolean;
  panelId?: string;
  statuses?: TaskStatus[];
  windowScroll?: boolean;
}

/** Fetches a project's canonical tasks and merges the open draft task. */
export function ProjectBoardPanel({ project, publicView, panelId, statuses, windowScroll }: ProjectBoardPanelProps) {
  const queryOptions = publicView
    ? publicTasksBoardQueryOptions(project.id)
    : tasksCanonicalOptions({ organizationId: project.organizationId, tenantId: project.tenantId, projectId: project.id });

  // The public and authenticated options share a data shape; the cast widens the key type
  const { data } = useSuspenseQuery(queryOptions as ReturnType<typeof tasksCanonicalOptions>);

  const isMobile = useBreakpointBelow('sm');
  const draftTask = useTaskInteractionStore((state) => state.draftTasks[project.id]);

  // The previous arrays let a panel whose tasks did not change keep its reference and skip re-rendering
  const projectTasksRef = useRef<Task[]>([]);
  const panelTasksRef = useRef<Task[]>([]);

  // Mobile creates through a dialog, so no draft row enters its list. Status panels give the draft to the panel of its status.
  const rawProjectTasks: Task[] = !isMobile && draftTask ? [...data.items, draftTask] : data.items;
  const projectTasks = stableArray(projectTasksRef.current, rawProjectTasks);
  projectTasksRef.current = projectTasks;

  const rawPanelTasks = statuses ? projectTasks.filter((task) => statuses.includes(task.status)) : projectTasks;
  const panelTasks = stableArray(panelTasksRef.current, rawPanelTasks);
  panelTasksRef.current = panelTasks;

  return (
    <BoardPanel
      fetchedTasks={panelTasks}
      project={project}
      projectFetchedCount={data.items.length}
      publicView={publicView}
      panelId={panelId ?? project.id}
      statuses={statuses}
      windowScroll={windowScroll}
    />
  );
}
