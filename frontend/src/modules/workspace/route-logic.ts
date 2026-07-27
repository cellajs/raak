import { getWorkspace } from 'sdk';
import { labelsCanonicalOptions } from '~/modules/label/query';
import { projectsListQueryOptions } from '~/modules/project/query';
import { resetTaskInteraction } from '~/modules/task/helpers/board-helpers';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { findWorkspaceByIdOrSlug, workspaceQueryKeys, workspaceQueryOptions } from '~/modules/workspace/query';
import { resolveChannelBySlug } from '~/query/basic/resolve-channel-by-slug';
import { queryClient } from '~/query/query-client';

type WorkspaceRouteBeforeLoadArgs = {
  params: { tenantId: string; slug: string };
  context: { organization: { id: string } };
  search: { projectSlug?: string };
};

/**
 * beforeLoad logic for the workspace route.
 * Resolves the workspace by slug or ID, seeds caches, rewrites the URL to use the slug,
 * and prefetches projects, labels and tasks so views don't waterfall.
 */
export const workspaceRouteBeforeLoad = async ({ params, context, search }: WorkspaceRouteBeforeLoadArgs) => {
  // Reset on entering another workspace (onLeave does not fire when only params change); keyed so
  // search-param-only navigations within the same workspace keep the selection.
  resetTaskInteraction(`workspace:${params.tenantId}:${params.slug}`);

  const { slug, tenantId } = params;
  const organizationId = context.organization.id;

  const workspace = await resolveChannelBySlug({
    idOrSlug: slug,
    tenantId,
    findInCache: findWorkspaceByIdOrSlug,
    detailQueryOptions: (id) => workspaceQueryOptions(id, organizationId, tenantId),
    fetchBySlug: () => getWorkspace({ path: { id: slug, organizationId, tenantId }, query: { slug: true } }),
    slugFetchCacheKey: workspaceQueryKeys.detail.byId,
    params,
    buildSlugOverrides: (entity) => ({ slug: entity.slug }),
    routeTo: '/$tenantId/$organizationSlug/workspace/$slug',
  });

  // Prefetch projects and tasks so views (board/table) don't waterfall. Labels are project-homed,
  // so they are prefetched per project in the loop below (alongside the per-project task queries).
  // Board uses excludeArchived='true' as a separate cache key, so prefetch both variants.
  queryClient.prefetchInfiniteQuery(projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts' }));
  queryClient.prefetchInfiniteQuery(
    projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts', excludeArchived: 'true' }),
  );

  // Prefetch per-project canonical task queries when projects are already cached
  const cachedProjects = queryClient.getQueryData(
    projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts' }).queryKey,
  );
  if (cachedProjects) {
    const allProjects = cachedProjects.pages.flatMap((p) => p.items);
    const isMobile = window.innerWidth < 640;

    // On mobile, only prefetch the active project (from URL or first) to reduce payload
    const projectsToPrefetch = isMobile
      ? [allProjects.find((p) => p.slug === search.projectSlug) ?? allProjects[0]].filter(Boolean)
      : allProjects;

    for (const project of projectsToPrefetch) {
      queryClient.prefetchQuery(tasksCanonicalOptions({ organizationId, tenantId, projectId: project.id }));
      queryClient.prefetchQuery(labelsCanonicalOptions({ organizationId, tenantId, projectId: project.id }));
    }
  }

  return { workspace };
};
