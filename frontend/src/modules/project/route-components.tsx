import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { Suspense } from 'react';
import { Spinner } from '~/modules/common/spinner';
import { organizationQueryOptions } from '~/modules/organization/query';
import { projectQueryOptions } from '~/modules/project/query';
import { BoardSkeleton } from '~/modules/task/board/board-skeleton';
import { lazyNamed } from '~/utils/lazy-named';

const ProjectPage = lazyNamed(() => import('~/modules/project/project-page'), 'ProjectPage');
const Board = lazyNamed(() => import('~/modules/task/board/task-board'), 'Board');
const TasksTable = lazyNamed(() => import('~/modules/task/table/tasks-table'), 'TasksTable');
const ProjectsTable = lazyNamed(() => import('~/modules/project/table/projects-table'), 'ProjectsTable');

const projectApi = getRouteApi('/_app/$tenantId/$organizationSlug/project/$slug');
const orgProjectsApi = getRouteApi('/_app/$tenantId/$organizationSlug/organization/projects');

export function ProjectRouteComponent() {
  // Ids and the view only: opening a task sheet or searching writes the URL, and the board must not re-render for it.
  const projectId = projectApi.useRouteContext({ select: (context) => context.project.id });
  const organizationId = projectApi.useRouteContext({ select: (context) => context.organization.id });
  const tenantId = projectApi.useRouteContext({ select: (context) => context.tenantId });
  const view = projectApi.useSearch({ select: (search) => search.view });
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId, organizationId, tenantId));
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));
  const projects = [project];

  return (
    <Suspense fallback={<Spinner size="lg" className="mt-[45vh]" />}>
      <ProjectPage key={project.slug} project={project} organization={organization}>
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

export function OrganizationProjectsComponent() {
  const organizationId = orgProjectsApi.useRouteContext({ select: (context) => context.organization.id });
  const tenantId = orgProjectsApi.useRouteContext({ select: (context) => context.tenantId });
  const { data } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));
  return (
    <Suspense>
      <ProjectsTable key={data.id} organization={data} />
    </Suspense>
  );
}
