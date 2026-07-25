import { useSearch } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { useBoardStore } from '~/modules/common/board/board-store';
import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import { ScrollReset } from '~/modules/common/scroll-reset';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { LABELS_PANEL_ID, LABELS_TAB_SLUG } from '~/modules/task/types';
import { lazyNamed } from '~/utils/lazy-named';

const LabelsTable = lazyNamed(() => import('~/modules/label/table/labels-table'), 'LabelsTable');

export function WorkspaceBoardTabs({
  projects,
  workspace,
  publicView,
}: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) {
  const { t } = useTranslation();
  const { projectSlug } = useSearch({ strict: false });

  // Sort projects by membership displayOrder (same as desktop board)
  const sorted = sortByMembership(projects);

  const showLabelsTab = !!workspace && !publicView;
  const isLabelsTab = showLabelsTab && projectSlug === LABELS_TAB_SLUG;

  // Finding project based on query parameter, default first project
  const currentProject = sorted.find((p) => p.slug === projectSlug) || sorted[0];

  // Set active panel to the current mobile tab
  const setActivePanel = useBoardStore((state) => state.setActivePanel);
  useEffect(() => {
    setActivePanel(isLabelsTab ? LABELS_PANEL_ID : currentProject.id);
  }, [isLabelsTab, currentProject.id, setActivePanel]);

  const projectTabs: PageTab[] = [
    ...sorted.map(
      (project: Project): PageTab => ({
        id: project.id,
        label: project.name,
        path: '/$tenantId/$organizationSlug/workspace/$slug',
        search: { projectSlug: project.slug },
        activeOptions: { exact: false, includeSearch: true },
      }),
    ),
    ...(showLabelsTab
      ? [
          {
            id: LABELS_PANEL_ID,
            label: t('c:label_other'),
            path: '/$tenantId/$organizationSlug/workspace/$slug',
            search: { projectSlug: LABELS_TAB_SLUG },
            activeOptions: { exact: false, includeSearch: true },
          } satisfies PageTab,
        ]
      : []),
  ];

  return (
    <ScrollReset>
      {workspace && <PageTabNav fallbackToFirst={!projectSlug} tabs={projectTabs} className="max-sm:border-t" />}
      {isLabelsTab && workspace ? (
        <Suspense>
          <div className="p-2">
            <LabelsTable entity="workspace" entityId={workspace.id} />
          </div>
        </Suspense>
      ) : (
        <Suspense>
          <ProjectBoardPanel project={currentProject} publicView={publicView} />
        </Suspense>
      )}
    </ScrollReset>
  );
}
