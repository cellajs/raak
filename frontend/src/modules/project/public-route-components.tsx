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
  const projectId = publicProjectApi.useRouteContext({ select: (context) => context.project.id });
  const view = publicProjectApi.useSearch({ select: (search) => search.view });
  const { data } = useSuspenseQuery(publicProjectQueryOptions(projectId));
  const projects = [data];
  // Not the project's id: a member's status panels and widths on that board are not for the public view
  const boardId = `public-${data.id}`;

  return (
    <PublicProjectPage key={data.id} project={data}>
      {view === 'table' ? (
        <Suspense>
          <TasksTable projects={projects} publicView />
        </Suspense>
      ) : (
        <Suspense fallback={<BoardSkeleton boardId={boardId} projects={projects} projectPage publicView />}>
          <Board boardId={boardId} projects={projects} publicView />
        </Suspense>
      )}
    </PublicProjectPage>
  );
}
