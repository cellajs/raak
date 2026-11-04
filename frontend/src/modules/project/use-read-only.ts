import { createContext, useContext, useSyncExternalStore } from 'react';
import { projectQueryKeys } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { findInCache } from '~/query/basic/find-in-list-cache';
import { findMembership, getCachedMemberships } from '~/query/enrichment/helpers';
import { queryClient } from '~/query/query-client';

/** Read-only for a guest membership or a project loaded through the public endpoint; read from the query cache, so it works in portals like the task sheet. */
export const isProjectReadOnly = (projectId: string | undefined): boolean => {
  if (!projectId) return false;

  const project = findInCache<EnrichedProject>('project', projectId);
  if (project) return findMembership(getCachedMemberships() ?? [], projectId)?.role === 'guest';

  // Known only through the public endpoint, which has no membership.
  if (queryClient.getQueryData(projectQueryKeys.detail.public(projectId))) return true;

  return false;
};

const subscribeToQueryCache = (onStoreChange: () => void) => queryClient.getQueryCache().subscribe(onStoreChange);

/**
 * True below a public view, which shows projects without editing them, also to their members: a member's cached
 * project would otherwise make cards editable there, and editing needs the organization route a public page lacks.
 */
export const ReadOnlyScope = createContext(false);

/** Re-renders only when this project's read-only answer flips. */
export const useIsProjectReadOnly = (projectId: string | undefined): boolean => {
  const inReadOnlyScope = useContext(ReadOnlyScope);
  const getSnapshot = () => inReadOnlyScope || isProjectReadOnly(projectId);
  return useSyncExternalStore(subscribeToQueryCache, getSnapshot, getSnapshot);
};

/** True for a guest membership only: a public view is read-only without one. */
export const useIsProjectGuest = (projectId: string | undefined): boolean => {
  const getSnapshot = () => !!projectId && findMembership(getCachedMemberships() ?? [], projectId)?.role === 'guest';
  return useSyncExternalStore(subscribeToQueryCache, getSnapshot, getSnapshot);
};

/** Those of `projectIds` that are read-only, on one subscription: a list of many rows would otherwise run a cache lookup per row on every query event. */
export const useReadOnlyProjectIds = (projectIds: string[]): string[] => {
  const getSnapshot = () => projectIds.filter(isProjectReadOnly).join();
  const joined = useSyncExternalStore(subscribeToQueryCache, getSnapshot, getSnapshot);
  return joined ? joined.split(',') : [];
};

/** Props to spread on elements that are disabled in read-only mode. */
export const useReadOnlyInert = (projectId: string | undefined) => {
  const isReadOnly = useIsProjectReadOnly(projectId);
  return isReadOnly ? ({ inert: true } as const) : ({} as const);
};

/** The `hidden!` class in read-only mode. */
export const useReadOnlyHide = (projectId: string | undefined) => {
  const isReadOnly = useIsProjectReadOnly(projectId);
  return isReadOnly ? 'hidden!' : '';
};
