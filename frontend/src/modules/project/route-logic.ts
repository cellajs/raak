import { onlineManager } from '@tanstack/react-query';
import { getProject, type Project } from 'sdk';
import { findProjectByIdOrSlug, projectQueryKeys, projectQueryOptions } from '~/modules/project/query';
import { resetTaskInteraction } from '~/modules/task/helpers/board-helpers';
import { fetchSlugCacheId } from '~/query/basic/fetch-slug-cache-id';
import { queryClient } from '~/query/query-client';
import { redirectOnMissing } from '~/utils/redirect-on-missing';
import { rewriteUrlToSlug } from '~/utils/rewrite-url-to-slug';

type ProjectRouteBeforeLoadArgs = {
  params: { tenantId: string; slug: string };
  context: { organization: { id: string } };
};

/**
 * beforeLoad logic for the project route.
 * Resolves the project by slug or ID, seeds caches, and rewrites the URL to use the slug.
 */
export const projectRouteBeforeLoad = async ({ params, context }: ProjectRouteBeforeLoadArgs) => {
  // Reset on every entry, including project-to-project switches (onLeave does not fire when only params change).
  resetTaskInteraction();

  const { slug, tenantId } = params;
  const organizationId = context.organization.id;

  const isOnline = onlineManager.isOnline();

  // Resolve slug to ID via list cache (from menu), or fetch if not cached
  const cached = findProjectByIdOrSlug(slug, tenantId);
  const projectId = cached?.id;

  let projectData: Project | undefined;

  if (projectId) {
    const options = projectQueryOptions(projectId, organizationId, tenantId);

    // Seed detail cache from list cache so ensureQueryData returns immediately
    // instead of blocking on a fetch. It will still revalidate in background if stale.
    if (cached && !queryClient.getQueryData(options.queryKey)) {
      queryClient.setQueryData(options.queryKey, cached);
    }

    projectData =
      queryClient.getQueryData(options.queryKey) ?? (isOnline ? await queryClient.ensureQueryData(options) : undefined);
  } else if (isOnline) {
    // Not in cache — fetch by slug
    projectData = await fetchSlugCacheId(
      () => getProject({ path: { id: slug, organizationId, tenantId }, query: { slug: true } }),
      projectQueryKeys.detail.byId,
    );
  }

  redirectOnMissing(projectData);

  // Rewrite URL to use slug if user navigated with ID (parent handles organizationId)
  rewriteUrlToSlug(params, { slug: projectData.slug }, '/$tenantId/$organizationSlug/project/$slug');

  return { project: projectData };
};
