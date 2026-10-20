import { useSearch } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import type { Project } from 'sdk';
import type { TKey } from '~/lib/i18n-locales';
import { useBoardStore } from '~/modules/common/board/board-store';
import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import { ScrollReset } from '~/modules/common/scroll-reset';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';

export function WorkspaceBoardTabs({ projects, workspace, publicView }: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) {
  const projectSlug = useSearch({ strict: false, select: (search) => search.projectSlug });

  const sorted = sortByMembership(projects);

  // Finding project based on query parameter, default first project
  const currentProject = sorted.find((p) => p.slug === projectSlug) || sorted[0];

  const setActivePanel = useBoardStore((state) => state.setActivePanel);
  useEffect(() => {
    setActivePanel(currentProject.id);
  }, [currentProject.id, setActivePanel]);

  const projectTabs: PageTab[] = sorted.map(
    (project: Project): PageTab => ({
      id: project.id,
      // Project names are display strings, not keys; PageTabNav's t() falls back to the raw name.
      label: project.name as TKey,
      path: '/$tenantId/$organizationSlug/workspace/$slug',
      search: { projectSlug: project.slug },
      activeOptions: { exact: false, includeSearch: true },
    }),
  );

  return (
    <ScrollReset>
      {workspace && <PageTabNav fallbackToFirst={!projectSlug} tabs={projectTabs} className="max-sm:border-t" />}
      <Suspense>
        <ProjectBoardPanel project={currentProject} publicView={publicView} />
      </Suspense>
    </ScrollReset>
  );
}
