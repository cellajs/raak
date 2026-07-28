import { getProject } from 'sdk';
import { labelsCanonicalOptions } from '~/modules/label/query';
import { findProjectByIdOrSlug, projectQueryKeys, projectQueryOptions } from '~/modules/project/query';
import { resetTaskInteraction } from '~/modules/task/helpers/board-helpers';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { resolveChannelBySlug } from '~/query/basic/resolve-channel-by-slug';
import { cacheRestored, queryClient } from '~/query/query-client';

type ProjectRouteBeforeLoadArgs = {
  params: { tenantId: string; slug: string };
  context: { organization: { id: string } };
};

/**
 * beforeLoad logic for the project route.
 * Resolves the project by slug or ID, seeds caches, and rewrites the URL to use the slug.
 */
export const projectRouteBeforeLoad = async ({ params, context }: ProjectRouteBeforeLoadArgs) => {
  // Reset on entering another project (onLeave does not fire when only params change); keyed so
  // search-param-only navigations within the same project keep the selection.
  resetTaskInteraction(`project:${params.tenantId}:${params.slug}`);

  const { slug, tenantId } = params;
  const organizationId = context.organization.id;

  const projectData = await resolveChannelBySlug({
    idOrSlug: slug,
    tenantId,
    findInCache: findProjectByIdOrSlug,
    detailQueryOptions: (id) => projectQueryOptions(id, organizationId, tenantId),
    fetchBySlug: () => getProject({ path: { id: slug, organizationId, tenantId }, query: { slug: true } }),
    slugFetchCacheKey: projectQueryKeys.detail.byId,
    params,
    buildSlugOverrides: (entity) => ({ slug: entity.slug }),
    routeTo: '/$tenantId/$organizationSlug/project/$slug',
  });

  // Warm the canonical task and label lists together so the board and its always-present labels
  // panel don't waterfall on mount (labels otherwise render a beat after tasks). Fire-and-forget.
  // Await cache restore first so an already-synced list is visible and these prefetches no-op;
  // without it a reload races restore, sees an empty cache, and refetches everything.
  await cacheRestored;
  queryClient.prefetchQuery(tasksCanonicalOptions({ organizationId, tenantId, projectId: projectData.id }));
  queryClient.prefetchQuery(labelsCanonicalOptions({ organizationId, tenantId, projectId: projectData.id }));

  return { project: projectData };
};
