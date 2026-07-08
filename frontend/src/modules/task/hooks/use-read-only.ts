import { useCallback, useSyncExternalStore } from 'react';
import { projectQueryKeys } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { findInCache } from '~/query/basic/find-in-list-cache';
import { queryClient } from '~/query/query-client';

/**
 * Read-only is a derivation, not a separate piece of state.
 *
 * A project is read-only when:
 *  - the user holds a `guest` membership for it (workspace/project pages), or
 *  - it was loaded via the public project endpoint (no membership exists).
 *
 * Both signals already live in the TanStack Query cache, so we read them directly. This avoids
 * the registration / cleanup pattern entirely (no store field, no provider, no effects) and
 * works in any render tree, including portals like the task sheet.
 */
export const isProjectReadOnly = (projectId: string | undefined): boolean => {
  if (!projectId) return false;

  // Prefer the regular cache: it's the most specific to the current context. A guest membership
  // is the canonical "read-only" signal for authenticated views.
  const project = findInCache<EnrichedProject>('project', projectId);
  if (project) return project.membership?.role === 'guest';

  // Fallback: the project is only known via the public endpoint → always read-only.
  if (queryClient.getQueryData(projectQueryKeys.detail.public(projectId))) return true;

  return false;
};

const subscribeToQueryCache = (cb: () => void) => queryClient.getQueryCache().subscribe(cb);

/**
 * Hook variant that re-renders only when the read-only answer for this project flips.
 * Backed by `useSyncExternalStore` over the query cache, so updates from any source
 * (membership change, project refetch, public-cache eviction) are observed automatically.
 */
export const useIsProjectReadOnly = (projectId: string | undefined): boolean => {
  const getSnapshot = useCallback(() => isProjectReadOnly(projectId), [projectId]);
  return useSyncExternalStore(subscribeToQueryCache, getSnapshot, getSnapshot);
};

/** Returns inert prop to spread on elements that should be disabled in read-only mode */
export const useReadOnlyInert = (projectId: string | undefined) => {
  const isReadOnly = useIsProjectReadOnly(projectId);
  return isReadOnly ? ({ inert: true } as const) : ({} as const);
};

/** Returns 'hidden!' class when in read-only mode, empty string otherwise */
export const useReadOnlyHide = (projectId: string | undefined) => {
  const isReadOnly = useIsProjectReadOnly(projectId);
  return isReadOnly ? 'hidden!' : '';
};
