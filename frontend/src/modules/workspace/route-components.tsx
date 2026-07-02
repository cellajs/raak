import { getRouteApi } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { appConfig } from 'shared';
import { YjsTokenFetcher } from '~/modules/common/blocknote/yjs-token-fetcher';
import { Spinner } from '~/modules/common/spinner';

const WorkspacePage = lazy(() => import('~/modules/workspace/workspace-page'));
const Board = lazy(() => import('~/modules/task/board/task-board'));
const TasksTable = lazy(() => import('~/modules/task/table/tasks-table'));

const orgLayoutApi = getRouteApi('/_app/$tenantId/$organizationSlug');
const workspaceRouteApi = getRouteApi('/_app/$tenantId/$organizationSlug/workspace/$slug');

export const WorkspaceRouteComponent = () => {
  const { workspace } = workspaceRouteApi.useRouteContext();
  const { organization, tenantId } = orgLayoutApi.useRouteContext();
  const { view } = workspaceRouteApi.useSearch();
  return (
    <Suspense fallback={<Spinner className="mt-[45vh] h-10 w-10" />}>
      {!!appConfig.yjsUrl && (
        <YjsTokenFetcher entityType="task" tenantId={tenantId} organizationId={workspace.organizationId} />
      )}
      <WorkspacePage
        key={workspace.slug}
        workspaceId={workspace.id}
        organizationId={workspace.organizationId}
        tenantId={tenantId}
      >
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
};
