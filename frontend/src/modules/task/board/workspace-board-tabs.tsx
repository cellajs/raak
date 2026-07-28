import { useSearch } from '@tanstack/react-router';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { useBoardStore } from '~/modules/common/board/board-store';
import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import { ScrollReset } from '~/modules/common/scroll-reset';
// LabelList is eager (always-present panel); LabelPage stays lazy (opened on demand, heavier).
import { LabelList } from '~/modules/label/label-list';
import { LABELS_PANEL_ID, LABELS_TAB_SLUG } from '~/modules/label/types';
import type { ResolvedBoardProps } from '~/modules/task/board/task-board';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { lazyNamed } from '~/utils/lazy-named';

const LabelPage = lazyNamed(() => import('~/modules/label/label-page'), 'LabelPage');

export function WorkspaceBoardTabs({
  projects,
  workspace,
  publicView,
}: Pick<ResolvedBoardProps, 'projects' | 'workspace' | 'publicView'>) {
  const { t } = useTranslation();
  const { projectSlug, labelPageId } = useSearch({ strict: false });

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
          {/* Same branching as the desktop LabelsPanel: an open label page replaces the list */}
          {labelPageId ? (
            <LabelPage labelId={labelPageId} entity="workspace" entityId={workspace.id} />
          ) : (
            <LabelList entity="workspace" entityId={workspace.id} />
          )}
        </Suspense>
      ) : (
        <Suspense>
          <ProjectBoardPanel project={currentProject} publicView={publicView} />
        </Suspense>
      )}
    </ScrollReset>
  );
}
