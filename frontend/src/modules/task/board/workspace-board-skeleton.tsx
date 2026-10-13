import { useInfiniteQuery } from '@tanstack/react-query';
import type { Workspace } from 'sdk';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { BoardEmpty } from '~/modules/task/board/board-empty';
import { BoardHeaderSkeleton, BoardSkeleton } from '~/modules/task/board/board-skeleton';
import { useCurrentUser } from '~/modules/user/user-store';
import { flattenInfiniteData } from '~/query/basic/flatten';

/**
 * Skeleton of a workspace board that anticipates its projects. Until the board's own project list is cached they come
 * from the user's project list the menu keeps: the board lists those same memberships, narrowed to the workspace.
 * A workspace known to hold no projects shows its empty state at once.
 */
export function WorkspaceBoardSkeleton({ workspace, withHeader = true }: { workspace: Workspace; withHeader?: boolean }) {
  const { id: userId } = useCurrentUser();
  const { data: boardProjects } = useInfiniteQuery(
    projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts', excludeArchived: 'true' }),
  );
  const { data: menuProjects, hasNextPage: menuHasMore } = useInfiniteQuery({
    ...projectsListQueryOptions({ relatableUserId: userId }),
    enabled: false,
  });

  const projects = boardProjects
    ? flattenInfiniteData<EnrichedProject>(boardProjects)
    : flattenInfiniteData<EnrichedProject>(menuProjects).filter(({ membership }) => membership?.workspaceId === workspace.id && !membership.archived);

  // A menu list with pages still to fetch cannot rule out projects in this workspace.
  const isComplete = !!boardProjects || (!!menuProjects && !menuHasMore);

  if (isComplete && !projects.length) {
    return (
      <>
        {withHeader && <BoardHeaderSkeleton isInWorkspace />}
        <BoardEmpty workspace={workspace} />
      </>
    );
  }

  return <BoardSkeleton boardId={workspace.id} projects={projects} isInWorkspace withHeader={withHeader} />;
}
