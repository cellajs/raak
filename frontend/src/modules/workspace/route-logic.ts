import { getWorkspace } from 'sdk';
import { labelsCanonicalOptions } from '~/modules/label/query';
import { projectsListQueryOptions } from '~/modules/project/query';
import { resetTaskInteraction } from '~/modules/task/helpers/board-helpers';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { findWorkspaceByIdOrSlug, workspaceQueryOptions } from '~/modules/workspace/query';
import { resolveChannelBySlug } from '~/query/basic/resolve-channel-by-slug';
import { cacheRestored, queryClient } from '~/query/query-client';

type WorkspaceRouteBeforeLoadArgs = {
  params: { tenantId: string; slug: string };
  context: { organization: { id: string } };
  search: { projectSlug?: string };
};

/** beforeLoad of the workspace route: resolves the workspace by slug or ID, seeds caches, rewrites the URL to the slug and prefetches the views' data. */
export const workspaceRouteBeforeLoad = async ({ params, context, search }: WorkspaceRouteBeforeLoadArgs) => {
  // Keyed by workspace because onLeave does not fire when only params change; search-param-only navigations keep the selection.
  resetTaskInteraction(`workspace:${params.tenantId}:${params.slug}`);

  const { slug, tenantId } = params;
  const organizationId = context.organization.id;

  const workspace = await resolveChannelBySlug({
    idOrSlug: slug,
    tenantId,
    findInCache: findWorkspaceByIdOrSlug,
    detailQueryOptions: (id) => workspaceQueryOptions(id, organizationId, tenantId),
    fetchBySlug: () => getWorkspace({ path: { id: slug, organizationId, tenantId }, query: { slug: true } }),
    params,
    buildSlugOverrides: (entity) => ({ slug: entity.slug }),
  });

  // Labels are project-homed, so they are prefetched per project with the tasks. The board uses excludeArchived='true'
  // as a separate cache key, so both project lists are prefetched. Restore first, so synced lists make these no-ops.
  await cacheRestored;
  const projectsQueryOptions = projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts' });
  const projectsPrefetch = queryClient.prefetchInfiniteQuery(projectsQueryOptions);
  queryClient.prefetchInfiniteQuery(projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts', excludeArchived: 'true' }));

  const prefetchPerProjectQueries = () => {
    const cachedProjects = queryClient.getQueryData(projectsQueryOptions.queryKey);
    if (!cachedProjects) return;
    const allProjects = cachedProjects.pages.flatMap((page) => page.items);
    const isMobile = window.innerWidth < 640;

    // On mobile, only prefetch the active project (from URL or first) to reduce payload
    const projectsToPrefetch = isMobile
      ? [allProjects.find((project) => project.slug === search.projectSlug) ?? allProjects[0]].filter(Boolean)
      : allProjects;

    for (const project of projectsToPrefetch) {
      queryClient.prefetchQuery(tasksCanonicalOptions({ organizationId, tenantId, projectId: project.id }));
      queryClient.prefetchQuery(labelsCanonicalOptions({ organizationId, tenantId, projectId: project.id }));
    }
  };

  if (queryClient.getQueryData(projectsQueryOptions.queryKey)) prefetchPerProjectQueries();
  else projectsPrefetch.then(prefetchPerProjectQueries);

  return { workspace };
};
