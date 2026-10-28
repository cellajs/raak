import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import type { Workspace } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { usePreloadLazyComponents } from '~/hooks/use-preload-lazy-components';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { useBoardStore } from '~/modules/common/board/board-store';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { BoardEmpty } from '~/modules/task/board/board-empty';
import { BoardHeader } from '~/modules/task/board/board-header';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';
import { MobileBoard } from '~/modules/task/board/mobile-board';
import { ProjectBoard } from '~/modules/task/board/project-board';
import { WorkspaceBoard } from '~/modules/task/board/workspace-board';
import { WorkspaceBoardSkeleton } from '~/modules/task/board/workspace-board-skeleton';
import { TaskSearchScope } from '~/modules/task/task-search-scope';
import { flattenInfiniteData } from '~/query/basic/flatten';

export interface BoardProps {
  boardId: string;
  projects?: EnrichedProject[];
  workspace?: Workspace;
  publicView?: boolean;
}

export interface ResolvedBoardProps extends Omit<BoardProps, 'projects'> {
  projects: EnrichedProject[];
}

interface BoardViewProps extends ResolvedBoardProps {
  isLoading: boolean;
}

function BoardView({ boardId, projects, workspace, publicView, isLoading }: BoardViewProps) {
  const isMobile = useBreakpointBelow('sm');

  if (isLoading && workspace) return <WorkspaceBoardSkeleton workspace={workspace} withHeader={false} />;
  if (isLoading) return <BoardSkeleton boardId={boardId} withHeader={false} publicView={publicView} />;
  if (!projects.length) return <BoardEmpty workspace={workspace} publicView={publicView} />;
  if (isMobile) return <MobileBoard projects={projects} workspace={workspace} publicView={publicView} />;
  if (!workspace) return <ProjectBoard boardId={boardId} projects={projects} publicView={publicView} />;
  return <WorkspaceBoard boardId={boardId} projects={projects} workspace={workspace} publicView={publicView} />;
}

export function Board({ boardId, projects: projectsProp, workspace, publicView }: BoardProps) {
  const router = useRouter();
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);

  // Preload BlockNoteFullHtml so expanding a task card doesn't show a spinner
  usePreloadLazyComponents([BlockNoteFullHtml]);

  const { data: fetchedData, isPending } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspace?.id, include: 'counts', excludeArchived: 'true' }),
    enabled: !projectsProp,
  });
  const projects = projectsProp ?? flattenInfiniteData<EnrichedProject>(fetchedData);
  const isLoadingProjects = !projectsProp && isPending;

  useEffect(() => {
    setActiveBoard(boardId);
  }, [boardId, setActiveBoard]);

  // One board-level subscription closes the mobile create-task dialog on navigation, not one per panel action
  useEffect(() => router.subscribe('onBeforeLoad', () => dialoger.getState().remove('create-task')), [router]);

  return (
    <MotionConfig reducedMotion="user">
      <TaskSearchScope>
        <BoardHeader boardId={boardId} projects={projects} workspace={workspace} publicView={publicView} />
        <BoardView boardId={boardId} projects={projects} workspace={workspace} publicView={publicView} isLoading={isLoadingProjects} />
      </TaskSearchScope>
    </MotionConfig>
  );
}
