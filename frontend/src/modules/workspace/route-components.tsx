import { Suspense } from 'react';
import { FocusViewContainer } from '~/modules/common/focus-view';
import { PageSpinner } from '~/modules/common/spinner';
import { WorkspaceBoardSkeleton } from '~/modules/task/board/workspace-board-skeleton';
import { useWorkspaceContext, workspaceRouteApi } from '~/modules/workspace/use-workspace-context';
import { lazyNamed } from '~/utils/lazy-named';

const WorkspacePage = lazyNamed(() => import('~/modules/workspace/workspace-page'), 'WorkspacePage');
const Board = lazyNamed(() => import('~/modules/task/board/task-board'), 'Board');
const TasksTable = lazyNamed(() => import('~/modules/task/table/tasks-table'), 'TasksTable');

export function WorkspaceRouteComponent() {
  const { workspace, organization, tenantId } = useWorkspaceContext();
  const view = workspaceRouteApi.useSearch({ select: (search) => search.view });
  const boardSkeleton = <WorkspaceBoardSkeleton workspace={workspace} />;

  // The frame sits outside the boundaries so the skeleton lands where the board will.
  return (
    <FocusViewContainer className="group/workspace h-full max-w-none gap-0 p-0 sm:gap-2 sm:p-3 md:gap-3">
      <Suspense fallback={view === 'table' ? <PageSpinner /> : boardSkeleton}>
        <WorkspacePage key={workspace.slug} workspaceId={workspace.id} organizationId={workspace.organizationId} tenantId={tenantId}>
          {view === 'table' ? (
            <Suspense>
              <TasksTable workspace={workspace} organization={organization} tenantId={tenantId} />
            </Suspense>
          ) : (
            <Suspense fallback={boardSkeleton}>
              <Board boardId={workspace.id} workspace={workspace} />
            </Suspense>
          )}
        </WorkspacePage>
      </Suspense>
    </FocusViewContainer>
  );
}
