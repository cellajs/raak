import { type UseSuspenseQueryResult, useSuspenseQueries } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { Suspense, useEffect, useState } from 'react';
import type { GetPublicProjectResponse } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import type { TKey } from '~/lib/i18n-locales';
import { BoardLayout } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { LocalTabNav } from '~/modules/common/page/local-tab-nav';
import { publicProjectQueryOptions } from '~/modules/project/query';
import { ReadOnlyScope } from '~/modules/project/use-read-only';
import { BoardHeader } from '~/modules/task/board/board-header';
import { useBoardPanels } from '~/modules/task/board/board-hooks';
import { MobilePanelSkeleton } from '~/modules/task/board/board-skeleton';
import { ProjectBoardPanel } from '~/modules/task/panel/project-board-panel';
import { TaskSearchScope } from '~/modules/task/task-search-scope';

// Module-level, so useSuspenseQueries keeps the combined arrays stable between renders
const toIds = (results: UseSuspenseQueryResult<GetPublicProjectResponse>[]) => results.map(({ data }) => data.id);
const toProjects = (results: UseSuspenseQueryResult<GetPublicProjectResponse>[]) => results.map(({ data }) => data);

interface PublicProjectsBoardProps {
  boardId: string;
  /** At least one. */
  slugs: string[];
}

/** Public projects side by side and read-only, filling a parent of fixed height: the board on pages outside the app. */
export function PublicProjectsBoard({ boardId, slugs }: PublicProjectsBoardProps) {
  const isMobile = useBreakpointBelow('sm');

  // Read-only detection finds a public project by id, so the slug lookup is followed by one by id, as on the public project route
  const projectIds = useSuspenseQueries({ queries: slugs.map((slug) => publicProjectQueryOptions(slug, true)), combine: toIds });
  const projects = useSuspenseQueries({ queries: projectIds.map((id) => publicProjectQueryOptions(id)), combine: toProjects });

  const { panels, layoutPanels, defaultLayout, handleLayoutChanged } = useBoardPanels(boardId, projects);

  const [mobileProjectId, setMobileProjectId] = useState(projects[0].id);
  const mobileProject = projects.find(({ id }) => id === mobileProjectId) ?? projects[0];

  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);
  useEffect(() => {
    setActiveBoard(boardId, 'project');
  }, [boardId, setActiveBoard]);

  return (
    <ReadOnlyScope.Provider value>
      <MotionConfig reducedMotion="user">
        <TaskSearchScope>
          <BoardHeader boardId={boardId} projects={projects} publicView viewToggle={false} />
          {isMobile ? (
            <>
              <LocalTabNav
                // Project names are display strings, not keys; the tab label's t() falls back to the raw name
                tabs={projects.map(({ id, name }) => ({ id, label: name as TKey }))}
                activeId={mobileProject.id}
                onTabChange={setMobileProjectId}
              />
              <div className="min-h-0 flex-1">
                <Suspense fallback={<MobilePanelSkeleton />}>
                  <ProjectBoardPanel project={mobileProject} publicView />
                </Suspense>
              </div>
            </>
          ) : (
            <BoardLayout
              boardId={boardId}
              panels={layoutPanels}
              defaultLayout={defaultLayout}
              onLayoutChanged={handleLayoutChanged}
              panelFade="marked"
              className="min-h-0 flex-1 sm:h-auto md:h-auto"
            >
              {(panelId) => {
                const panel = panels.find((candidate) => candidate.panelId === panelId);
                if (panel?.kind !== 'project') return null;
                return <ProjectBoardPanel project={panel.project} publicView sectionFilters={panel.sectionFilters} showProject />;
              }}
            </BoardLayout>
          )}
        </TaskSearchScope>
      </MotionConfig>
    </ReadOnlyScope.Provider>
  );
}
