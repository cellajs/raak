import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useRef } from 'react';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import type { EnrichedProject } from '~/modules/project/types';
import { BoardPanel } from '~/modules/task/panel/board-panel';
import { publicTasksBoardQueryOptions } from '~/modules/task/public-query';
import { tasksCanonicalOptions, tasksOlderAcceptedOptions } from '~/modules/task/query';
import { boardFilterList } from '~/modules/task/search-params-schemas';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import type { ProjectPageGroup, Task } from '~/modules/task/types';
import { stableArray } from '~/utils/stable-array';

interface ProjectBoardPanelProps {
  project: EnrichedProject;
  publicView?: boolean;
  panelId?: string;
  statuses?: TaskStatus[];
  group?: ProjectPageGroup;
  windowScroll?: boolean;
}

/** Fetches a project's canonical tasks, adds the searched labels' older accepted tasks, and merges the open draft task. */
export function ProjectBoardPanel({ project, publicView, panelId, statuses, group, windowScroll }: ProjectBoardPanelProps) {
  // Reads and writes refs during render: stableArray keeps the previous task arrays so a panel whose tasks did not change skips re-rendering.
  'use no memo';
  const { organizationId, tenantId } = project;
  const queryOptions = publicView
    ? publicTasksBoardQueryOptions(project.id)
    : tasksCanonicalOptions({ organizationId, tenantId, projectId: project.id });

  // The public and authenticated options share a data shape; the cast widens the key type
  const { data } = useSuspenseQuery(queryOptions as ReturnType<typeof tasksCanonicalOptions>);

  // A search of labels that would list accepted tasks: the home list holds only the recent ones, so the rest of those labels' are fetched
  const olderLabels = useSearch({
    strict: false,
    select: (search) => {
      const searchStatuses = boardFilterList.parse(search.status);
      const showsAccepted = !searchStatuses.length || searchStatuses.includes('accepted');
      return showsAccepted ? boardFilterList.parse(search.labels).join(',') : '';
    },
  });
  const { data: older } = useQuery({
    ...tasksOlderAcceptedOptions({ organizationId, tenantId, projectId: project.id, labels: olderLabels.split(',') }),
    enabled: !publicView && !!olderLabels,
  });
  const includesOlderAccepted = !publicView && !!olderLabels && !!older;

  const isMobile = useBreakpointBelow('sm');
  const draftTask = useTaskInteractionStore((state) => state.draftTasks[project.id]);

  // The previous arrays let a panel whose tasks did not change keep its reference and skip re-rendering
  const projectTasksRef = useRef<Task[]>([]);
  const panelTasksRef = useRef<Task[]>([]);

  // The home list wins: a task that is in both (just reopened, or a realtime echo) shows once, as the home list has it
  let fetchedTasks: Task[] = data.items;
  if (includesOlderAccepted && older.items.length) {
    const homeIds = new Set(data.items.map(({ id }) => id));
    const olderTasks = older.items.filter((task) => task.status === TaskStatus.Accepted && !homeIds.has(task.id));
    if (olderTasks.length) fetchedTasks = [...data.items, ...olderTasks];
  }

  // Mobile creates through a dialog, so no draft row enters its list. A panel of some statuses lists the draft while it has one of them.
  const rawProjectTasks: Task[] = !isMobile && draftTask ? [...fetchedTasks, draftTask] : fetchedTasks;
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
      group={group}
      windowScroll={windowScroll}
      includesOlderAccepted={includesOlderAccepted}
    />
  );
}
