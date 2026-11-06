import { useSearch } from '@tanstack/react-router';
import { Suspense, useEffect, useRef } from 'react';
import { ScrollReset } from '~/modules/common/scroll-reset';
import type { EnrichedProject, ProjectWithMembership } from '~/modules/project/types';
import { useProjectPageTab, useTabProject } from '~/modules/task/board/board-hooks';
import { MobilePanelSkeleton } from '~/modules/task/board/board-skeleton';
import { PanelTabNav } from '~/modules/task/board/panel-tab-nav';
import { ProjectTabNav } from '~/modules/task/board/project-tab-nav';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';

/** A phone's workspace board: one project at a time, under its project tabs. */
export function MobileWorkspaceBoard({ projects }: { projects: ProjectWithMembership[] }) {
  const currentProject = useTabProject(projects);

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

/** A phone's project page: the project's tasks under one tab per panel, To do, In progress and Done. */
export function MobileProjectBoard({ project, publicView }: MobileProjectBoardProps) {
  const panelTab = useSearch({ strict: false, select: (search) => search.panelTab });
  const tab = useProjectPageTab();

  // Tasks selected on another tab are out of view, yet would still take the bar's actions. A search keeps the tab, and so the selection.
  const lastPanelTabRef = useRef(panelTab);
  useEffect(() => {
    if (lastPanelTabRef.current === panelTab) return;
    lastPanelTabRef.current = panelTab;
    taskInteractionStore.getState().setSelectedTaskIds([]);
  }, [panelTab]);

  return (
    <ScrollReset>
      <PanelTabNav publicView={publicView} />
      <Suspense fallback={<MobilePanelSkeleton statuses={tab?.statuses} />}>
        {/* Keyed: virtua keeps measured heights by index, and they are another list's on the next tab */}
        <ProjectBoardPanel key={tab?.group ?? 'search'} project={project} publicView={publicView} statuses={tab?.statuses} group={tab?.group} />
      </Suspense>
    </ScrollReset>
  );
}
