import { useSearch } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { useBoardStore } from '~/modules/common/board/board-store';
import { ScrollReset } from '~/modules/common/scroll-reset';
import { MobilePanelSkeleton } from '~/modules/task/board/board-skeleton';
import { ProjectTabNav } from '~/modules/task/board/project-tab-nav';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

export function MobileBoard({ projects, workspace, publicView }: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) {
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });

  const sorted = sortByMembership(projects);

  const currentProject = sorted.find((project) => project.slug === projectSlug) || sorted[0];

  const setActivePanel = useBoardStore((state) => state.setActivePanel);
  useEffect(() => {
    setActivePanel(currentProject.id);
  }, [currentProject.id, setActivePanel]);

  return (
    <ScrollReset>
      {workspace && <ProjectTabNav projects={projects} />}
      {/* Mobile prefetches only the open project's tasks, so a tab switch can suspend too */}
      <Suspense fallback={<MobilePanelSkeleton />}>
        <ProjectBoardPanel project={currentProject} publicView={publicView} />
      </Suspense>
    </ScrollReset>
  );
}
