import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { PublicProjectPage } from '~/modules/project/public-project-page';
import { publicProjectQueryOptions } from '~/modules/project/query';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';

const Board = lazy(() => import('~/modules/task/board/task-board'));
const TasksTable = lazy(() => import('~/modules/task/table/tasks-table'));

const publicProjectApi = getRouteApi('/_public/_content/$tenantId/$organizationSlug/public/project/$slug');

export const PublicProjectRouteComponent = () => {
  const { project } = publicProjectApi.useRouteContext();
  const { view } = publicProjectApi.useSearch();
  const { data } = useSuspenseQuery(publicProjectQueryOptions(project.id));
  return (
    <PublicProjectPage key={data.id} project={data}>
      {view === 'table' ? (
        <Suspense>
          <TasksTable projects={[data]} publicView />
        </Suspense>
      ) : (
        <Suspense fallback={<BoardSkeleton boardId={data.id} projects={[data]} projectPage={true} />}>
          <Board boardId={data.id} projects={[data]} publicView />
        </Suspense>
      )}
    </PublicProjectPage>
  );
};
