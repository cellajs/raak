import { getRouteApi } from '@tanstack/react-router';
import { Suspense } from 'react';
import { PageSpinner } from '~/modules/common/spinner';
import { useWorkspaceContext } from '~/modules/workspace/use-workspace-context';
import { lazyNamed } from '~/utils/lazy-named';

const WorkspacePage = lazyNamed(() => import('~/modules/workspace/workspace-page'), 'WorkspacePage');
const Board = lazyNamed(() => import('~/modules/task/board/task-board'), 'Board');
const TasksTable = lazyNamed(() => import('~/modules/task/table/tasks-table'), 'TasksTable');

const workspaceRouteApi = getRouteApi('/_app/$tenantId/$organizationSlug/workspace/$slug');

export function WorkspaceRouteComponent() {
  const { workspace, organization, tenantId } = useWorkspaceContext();
  const view = workspaceRouteApi.useSearch({ select: (search) => search.view });

  return (
    <Suspense fallback={<PageSpinner />}>
      <WorkspacePage key={workspace.slug} workspaceId={workspace.id} organizationId={workspace.organizationId} tenantId={tenantId}>
        {view === 'table' ? (
          <Suspense>
            <TasksTable workspace={workspace} organization={organization} tenantId={tenantId} />
          </Suspense>
        ) : (
          <Suspense>
            <Board boardId={workspace.id} workspace={workspace} />
          </Suspense>
        )}
      </WorkspacePage>
    </Suspense>
  );
}
