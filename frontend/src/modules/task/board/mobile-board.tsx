import { useSearch } from '@tanstack/react-router';
import { Suspense, useEffect, useRef } from 'react';
import { ScrollReset } from '~/modules/common/scroll-reset';
import type { EnrichedProject } from '~/modules/project/types';
import { useStatusTabList } from '~/modules/task/board/board-hooks';
import { MobilePanelSkeleton } from '~/modules/task/board/board-skeleton';
import { ProjectTabNav } from '~/modules/task/board/project-tab-nav';
import { StatusTabNav } from '~/modules/task/board/status-tab-nav';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';

/** A phone's workspace board: one project at a time, under its project tabs. */
export function MobileWorkspaceBoard({ projects }: { projects: EnrichedProject[] }) {
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });

  const sorted = sortByMembership(projects);

  const currentProject = sorted.find((project) => project.slug === projectSlug) || sorted[0];

  // A phone shows one project: a selection in another is out of view, yet it would disable this tab's checkboxes and take the bar's actions
  useEffect(() => {
    const { selectedProjectId, setSelectedTaskIds } = taskInteractionStore.getState();
    if (selectedProjectId && selectedProjectId !== currentProject.id) setSelectedTaskIds([]);
  }, [currentProject.id]);

  return (
    <ScrollReset>
      <ProjectTabNav projects={projects} />
      {/* Mobile prefetches only the open project's tasks, so a tab switch can suspend too */}
      <Suspense fallback={<MobilePanelSkeleton />}>
        <ProjectBoardPanel project={currentProject} />
      </Suspense>
    </ScrollReset>
  );
}

interface MobileProjectBoardProps {
  project: EnrichedProject;
  publicView?: boolean;
}

/** A phone's project page: the project's tasks under one tab per status. */
export function MobileProjectBoard({ project, publicView }: MobileProjectBoardProps) {
  const statusTab = useSearch({ strict: false, select: (search) => search.statusTab });
  const statuses = useStatusTabList();

  // Tasks selected on another tab are out of view, yet would still take the bar's actions. A search keeps the tab, and so the selection.
  const lastStatusTabRef = useRef(statusTab);
  useEffect(() => {
    if (lastStatusTabRef.current === statusTab) return;
    lastStatusTabRef.current = statusTab;
    taskInteractionStore.getState().setSelectedTaskIds([]);
  }, [statusTab]);

  return (
    <ScrollReset>
      <StatusTabNav />
      <Suspense fallback={<MobilePanelSkeleton />}>
        {/* Keyed: virtua keeps measured heights by index, and they are another list's on the next tab */}
        <ProjectBoardPanel key={statuses?.[0] ?? 'all'} project={project} publicView={publicView} statuses={statuses} />
      </Suspense>
    </ScrollReset>
  );
}
