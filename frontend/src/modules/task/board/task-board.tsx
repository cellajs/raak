import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Project, Workspace } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { usePreloadLazyComponents } from '~/hooks/use-preload-lazy-components';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { useBoardStore } from '~/modules/common/board/board-store';
import { projectsListQueryOptions } from '~/modules/project/query';
import { AvailableProjectsAlert } from '~/modules/task/board/available-projects-alert';
import { BoardEmpty } from '~/modules/task/board/board-empty';
import { BoardHeader } from '~/modules/task/board/board-header';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';
import ProjectBoard from '~/modules/task/board/project-board';
import WorkspaceBoard from '~/modules/task/board/workspace-board';
import { WorkspaceBoardTabs } from '~/modules/task/board/workspace-board-tabs';
import { flattenInfiniteData } from '~/query/basic';

export interface BoardProps {
  boardId: string;
  projects?: Project[];
  workspace?: Workspace;
  publicView?: boolean;
}

/** Props for child components that receive already-resolved projects */
export type ResolvedBoardProps = Omit<BoardProps, 'projects'> & { projects: Project[] };

/**
 * Main task board component that conditionally renders desktop or mobile views based on screen size.
 */
export default function Board({ boardId, projects: projectsProp, workspace, publicView }: BoardProps) {
  const isMobile = useBreakpointBelow('sm');
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);

  // Preload BlockNoteFullHtml so expanding a task card doesn't show a spinner
  usePreloadLazyComponents([BlockNoteFullHtml]);

  // Fetch projects for workspace boards; use provided projects for single-project boards
  const { data: fetchedData, isPending } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspace?.id, include: 'counts', excludeArchived: 'true' }),
    enabled: !projectsProp,
  });
  const projects = projectsProp ?? flattenInfiniteData<Project>(fetchedData);
  const isLoadingProjects = !projectsProp && isPending;

  // Set the active board in the store
  useEffect(() => {
    setActiveBoard(boardId, workspace ? 'workspace' : 'project');
  }, [boardId, workspace, setActiveBoard]);

  const BoardView = (() => {
    if (isLoadingProjects) return <BoardSkeleton boardId={boardId} />;
    if (!projects.length) return <BoardEmpty />;
    if (isMobile) return <WorkspaceBoardTabs projects={projects} workspace={workspace} publicView={publicView} />;
    if (!workspace)
      return <ProjectBoard boardId={boardId} projects={projects} workspace={workspace} publicView={publicView} />;
    return <WorkspaceBoard boardId={boardId} projects={projects} workspace={workspace} publicView={publicView} />;
  })();

  return (
    <>
      <BoardHeader projects={projects} workspace={workspace} publicView={publicView} />
      {workspace && !publicView && !projects.length && <AvailableProjectsAlert workspace={workspace} />}
      {BoardView}
    </>
  );
}
