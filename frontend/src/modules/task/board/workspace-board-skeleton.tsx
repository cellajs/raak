import { useInfiniteQuery } from '@tanstack/react-query';
import type { Workspace } from 'sdk';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { useWithMembership } from '~/modules/project/use-with-membership';
import { BoardEmpty } from '~/modules/task/board/board-empty';
import { BoardHeaderSkeleton, BoardSkeleton } from '~/modules/task/board/board-skeleton';
import { useCurrentUser } from '~/modules/user/user-store';
import { flattenInfiniteData } from '~/query/basic/flatten';

interface WorkspaceBoardSkeletonProps {
  workspace: Workspace;
  withHeader?: boolean;
}

/** Until the board's own project list is cached, its projects come from the user's menu list, narrowed to the workspace. */
export function WorkspaceBoardSkeleton({ workspace, withHeader = true }: WorkspaceBoardSkeletonProps) {
  const { id: userId } = useCurrentUser();
  const { data: boardProjects } = useInfiniteQuery(
    projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts', excludeArchived: 'true' }),
  );
  const { data: menuProjects, hasNextPage: menuHasMore } = useInfiniteQuery({
    ...projectsListQueryOptions({ relatableUserId: userId }),
    enabled: false,
  });

  const joinedMenuProjects = useWithMembership(flattenInfiniteData<EnrichedProject>(menuProjects));
  const joinedBoardProjects = useWithMembership(flattenInfiniteData<EnrichedProject>(boardProjects));
  const projects = boardProjects
    ? joinedBoardProjects
    : joinedMenuProjects.filter(({ membership }) => membership?.workspaceId === workspace.id && !membership.archived);

  // A menu list with pages still to fetch cannot rule out projects in this workspace.
  const isComplete = !!boardProjects || (!!menuProjects && !menuHasMore);

  if (isComplete && !projects.length) {
    return (
      <>
        {withHeader && <BoardHeaderSkeleton isInWorkspace />}
        <BoardEmpty />
      </>
    );
  }

  return <BoardSkeleton boardId={workspace.id} projects={projects} isInWorkspace withHeader={withHeader} />;
}
