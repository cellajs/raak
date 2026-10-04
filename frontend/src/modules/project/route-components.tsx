import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Suspense } from 'react';
import { PageSpinner } from '~/modules/common/spinner';
import { organizationQueryOptions } from '~/modules/organization/query';
import { projectQueryOptions } from '~/modules/project/query';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';
import { lazyNamed } from '~/utils/lazy-named';

const ProjectPage = lazyNamed(() => import('~/modules/project/project-page'), 'ProjectPage');
const Board = lazyNamed(() => import('~/modules/task/board/task-board'), 'Board');
const TasksTable = lazyNamed(() => import('~/modules/task/table/tasks-table'), 'TasksTable');

const projectApi = getRouteApi('/_app/$tenantId/$organizationSlug/project/$slug');

export function ProjectRouteComponent() {
  // Ids and the view only: opening a task sheet or searching writes the URL, and the board must not re-render for it.
  const projectId = projectApi.useRouteContext({ select: (c) => c.project.id });
  const organizationId = projectApi.useRouteContext({ select: (c) => c.organization.id });
  const tenantId = projectApi.useRouteContext({ select: (c) => c.tenantId });
  const view = projectApi.useSearch({ select: (search) => search.view });
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId, organizationId, tenantId));
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));
  const projects = [project];

  return (
    <Suspense fallback={<PageSpinner />}>
      <ProjectPage key={project.slug} projectId={project.id} organizationId={project.organizationId} organization={organization} tenantId={tenantId}>
        {view === 'table' ? (
          <Suspense>
            <TasksTable projects={projects} organization={organization} tenantId={tenantId} />
          </Suspense>
        ) : (
          <Suspense fallback={<BoardSkeleton boardId={project.id} projects={projects} projectPage={true} />}>
            <Board boardId={project.id} projects={projects} />
          </Suspense>
        )}
      </ProjectPage>
    </Suspense>
  );
}
