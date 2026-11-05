import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter, useSearch } from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';
import { type CSSProperties, useEffect, useLayoutEffect } from 'react';
import type { Workspace } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useMeasure } from '~/hooks/use-measure';
import { useBoardStore } from '~/modules/common/board/board-store';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { SearchScope } from '~/modules/common/match-highlight/match-scope';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject, ProjectWithMembership } from '~/modules/project/types';
import { useWithMembership } from '~/modules/project/use-with-membership';
import { BoardEmpty } from '~/modules/task/board/board-empty';
import { BoardHeader } from '~/modules/task/board/board-header';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';
import { MobileProjectBoard, MobileWorkspaceBoard } from '~/modules/task/board/mobile-board';
import { ProjectBoard } from '~/modules/task/board/project-board';
import { UnseenTasksSnapshot } from '~/modules/task/board/unseen-tasks-snapshot';
import { WorkspaceBoard } from '~/modules/task/board/workspace-board';
import { WorkspaceBoardSkeleton } from '~/modules/task/board/workspace-board-skeleton';
import { TaskGuestAlert } from '~/modules/task/task-guest-alert';
import { ProjectArchivedBanner } from '~/modules/workspace/project-archived-banner';
import { flattenInfiniteData } from '~/query/basic/flatten';

export interface BoardProps {
  boardId: string;
  projects?: EnrichedProject[];
  workspace?: Workspace;
  publicView?: boolean;
}

export interface ResolvedBoardProps extends Omit<BoardProps, 'projects'> {
  projects: ProjectWithMembership[];
}

interface BoardViewProps extends ResolvedBoardProps {
  isLoading: boolean;
}

function BoardView({ boardId, projects, workspace, publicView, isLoading }: BoardViewProps) {
  const isMobile = useBreakpointBelow('sm');

  if (isLoading && workspace) return <WorkspaceBoardSkeleton workspace={workspace} withHeader={false} />;
  if (isLoading) return <BoardSkeleton boardId={boardId} withHeader={false} publicView={publicView} />;
  if (!projects.length) return <BoardEmpty />;
  if (isMobile && workspace) return <MobileWorkspaceBoard projects={projects} />;
  if (isMobile) return <MobileProjectBoard project={projects[0]} publicView={publicView} />;
  if (!workspace) return <ProjectBoard boardId={boardId} projects={projects} publicView={publicView} />;
  return <WorkspaceBoard boardId={boardId} projects={projects} workspace={workspace} publicView={publicView} />;
}

export function Board({ boardId, projects: projectsProp, workspace, publicView }: BoardProps) {
  const router = useRouter();
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);
  const q = useSearch({ strict: false, select: (search) => search.q });

  const { data: fetchedData, isPending } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspace?.id, include: 'counts', excludeArchived: 'true' }),
    enabled: !projectsProp,
  });
  const projects = useWithMembership(projectsProp ?? flattenInfiniteData<EnrichedProject>(fetchedData));
  const isLoadingProjects = !projectsProp && isPending;
  const pageProject = workspace || publicView ? undefined : projects[0];
  const { ref: bannerRef, bounds: bannerBounds } = useMeasure<HTMLDivElement>();

  // Before paint: panels read which way their lists run from the active board
  useLayoutEffect(() => {
    setActiveBoard(boardId);
  }, [boardId, setActiveBoard]);

  // One board-level subscription closes the mobile create-task dialog on navigation, not one per panel action
  useEffect(() => router.subscribe('onBeforeLoad', () => dialoger.getState().remove('create-task')), [router]);

  return (
    <MotionConfig reducedMotion="user">
      {!publicView && <UnseenTasksSnapshot key={boardId} />}
      <SearchScope q={q}>
        <BoardHeader projects={projects} workspace={workspace} publicView={publicView} />
        {pageProject && (
          // Its padding stands in for the page's gap, cancelled by the margin, so the measured height holds the space the banner takes from the board
          <div ref={bannerRef} className="flex flex-col gap-2 empty:hidden max-sm:px-2 max-sm:pb-2 sm:-mb-2 sm:pb-2 md:-mb-3 md:pb-3">
            <ProjectArchivedBanner key={pageProject.id} project={pageProject} />
            <TaskGuestAlert projectId={pageProject.id} />
          </div>
        )}
        {/* The offsets are computed where the class is, so this level picks up the banner's height */}
        <div
          className={pageProject ? 'project-board-offsets contents' : 'contents'}
          style={{ '--project-banner-h': `${bannerBounds.height}px` } as CSSProperties}
        >
          <BoardView boardId={boardId} projects={projects} workspace={workspace} publicView={publicView} isLoading={isLoadingProjects} />
        </div>
      </SearchScope>
    </MotionConfig>
  );
}
