import { onlineManager } from '@tanstack/react-query';
import { getWorkspace, type Workspace } from 'sdk';
import { labelsCanonicalOptions } from '~/modules/label/query';
import { projectsListQueryOptions } from '~/modules/project/query';
import { resetTaskInteraction } from '~/modules/task/helpers/board-helpers';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { findWorkspaceByIdOrSlug, workspaceQueryKeys, workspaceQueryOptions } from '~/modules/workspace/query';
import { fetchSlugCacheId } from '~/query/basic/fetch-slug-cache-id';
import { queryClient } from '~/query/query-client';
import { redirectOnMissing } from '~/utils/redirect-on-missing';
import { rewriteUrlToSlug } from '~/utils/rewrite-url-to-slug';

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
  // Reset on every entry, including workspace-to-workspace switches (onLeave does not fire when only params change).
  resetTaskInteraction();

  const { slug, tenantId } = params;
  const organizationId = context.organization.id;

  const isOnline = onlineManager.isOnline();

  // Resolve slug to ID via list cache (from menu), or fetch if not cached
  const cached = findWorkspaceByIdOrSlug(slug, tenantId);
  const workspaceId = cached?.id;

  let workspace: Workspace | undefined;

  if (workspaceId) {
    const options = workspaceQueryOptions(workspaceId, organizationId, tenantId);

    // Seed detail cache from list cache so ensureQueryData returns immediately
    // instead of blocking on a fetch. It will still revalidate in background if stale.
    if (cached && !queryClient.getQueryData(options.queryKey)) {
      queryClient.setQueryData(options.queryKey, cached);
    }

    workspace =
      queryClient.getQueryData(options.queryKey) ?? (isOnline ? await queryClient.ensureQueryData(options) : undefined);
  } else if (isOnline) {
    // Not in cache — fetch by slug
    workspace = await fetchSlugCacheId(
      () => getWorkspace({ path: { id: slug, organizationId, tenantId }, query: { slug: true } }),
      workspaceQueryKeys.detail.byId,
    );
  }

  redirectOnMissing(workspace);

  // Rewrite URL to use slug if user navigated with ID (parent handles organizationId)
  rewriteUrlToSlug(params, { slug: workspace.slug }, '/$tenantId/$organizationSlug/workspace/$slug');

  // Prefetch projects, labels and tasks so views (board/table) don't waterfall.
  // Board uses excludeArchived='true' (a separate cache key) — prefetch both variants.
  queryClient.prefetchInfiniteQuery(projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts' }));
  queryClient.prefetchInfiniteQuery(
    projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts', excludeArchived: 'true' }),
  );
  queryClient.prefetchQuery(labelsCanonicalOptions({ organizationId, tenantId }));

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
    }
  }

  return { workspace };
};
