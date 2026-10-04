import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Suspense } from 'react';
import { PublicProjectPage } from '~/modules/project/public-project-page';
import { publicProjectQueryOptions } from '~/modules/project/query';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';
import { lazyNamed } from '~/utils/lazy-named';

const Board = lazyNamed(() => import('~/modules/task/board/task-board'), 'Board');
const TasksTable = lazyNamed(() => import('~/modules/task/table/tasks-table'), 'TasksTable');

const publicProjectApi = getRouteApi('/_public/_content/$tenantId/$organizationSlug/public/project/$slug');

export function PublicProjectRouteComponent() {
  const projectId = publicProjectApi.useRouteContext({ select: (c) => c.project.id });
  const view = publicProjectApi.useSearch({ select: (search) => search.view });
  const { data } = useSuspenseQuery(publicProjectQueryOptions(projectId));
  const projects = [data];
  return (
    <PublicProjectPage key={data.id} project={data}>
      {view === 'table' ? (
        <Suspense>
          <TasksTable projects={projects} publicView />
        </Suspense>
      ) : (
        <Suspense fallback={<BoardSkeleton boardId={data.id} projects={projects} projectPage={true} publicView />}>
          <Board boardId={data.id} projects={projects} publicView />
        </Suspense>
      )}
    </PublicProjectPage>
  );
}
