import { getRouteApi } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { appConfig } from 'shared';
import { YjsTokenFetcher } from '~/modules/common/blocknote/yjs-token-fetcher';
import { Spinner } from '~/modules/common/spinner';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';

const ProjectPage = lazy(() => import('~/modules/project/project-page'));
const Board = lazy(() => import('~/modules/task/board/task-board'));
const TasksTable = lazy(() => import('~/modules/task/table/tasks-table'));

const projectApi = getRouteApi('/_app/$tenantId/$organizationSlug/project/$slug');

export const ProjectRouteComponent = () => {
  const { project, organization, tenantId } = projectApi.useRouteContext();
  const { view } = projectApi.useSearch();
  return (
    <Suspense fallback={<Spinner className="mt-[45vh] h-10 w-10" />}>
      {!!appConfig.yjsUrl && (
        <YjsTokenFetcher entityType="task" tenantId={tenantId} organizationId={project.organizationId} />
      )}
      <ProjectPage
        key={project.slug}
        projectId={project.id}
        organizationId={project.organizationId}
        organization={organization}
        tenantId={tenantId}
      >
        {view === 'table' ? (
          <Suspense>
            <TasksTable projects={[project]} organization={organization} tenantId={tenantId} />
          </Suspense>
        ) : (
          <Suspense fallback={<BoardSkeleton boardId={project.id} projects={[project]} projectPage={true} />}>
            <Board boardId={project.id} projects={[project]} />
          </Suspense>
        )}
      </ProjectPage>
    </Suspense>
  );
};
