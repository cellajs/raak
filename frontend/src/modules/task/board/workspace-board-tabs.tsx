import { useSearch } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import type { Project } from 'sdk';
import { useBoardStore } from '~/modules/common/board/board-store';
import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import { ScrollReset } from '~/modules/common/scroll-reset';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

export function WorkspaceBoardTabs({
  projects,
  workspace,
  publicView,
}: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) {
  const { projectSlug } = useSearch({ strict: false });

  // Sort projects by membership displayOrder (same as desktop board)
  const sorted = sortByMembership(projects);

  // Finding project based on query parameter, default first project
  const currentProject = sorted.find((p) => p.slug === projectSlug) || sorted[0];

  // Set active panel to the current mobile project tab
  const setActivePanel = useBoardStore((state) => state.setActivePanel);
  useEffect(() => {
    setActivePanel(currentProject.id);
  }, [currentProject.id, setActivePanel]);

  const projectTabs: PageTab[] = sorted.map((project: Project) => ({
    id: project.id,
    label: project.name,
    path: '/$tenantId/$organizationSlug/workspace/$slug',
    search: { projectSlug: project.slug },
    activeOptions: { exact: false, includeSearch: true },
  }));

  return (
    <ScrollReset>
      {workspace && <PageTabNav fallbackToFirst={!projectSlug} tabs={projectTabs} className="max-sm:border-t" />}
      <Suspense>
        <ProjectBoardPanel project={currentProject} publicView={publicView} />
      </Suspense>
    </ScrollReset>
  );
}
