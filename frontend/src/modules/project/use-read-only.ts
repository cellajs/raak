import { useSyncExternalStore } from 'react';
import { projectQueryKeys } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { findInCache } from '~/query/basic/find-in-list-cache';
import { queryClient } from '~/query/query-client';

/** Read-only for a guest membership or a project loaded through the public endpoint; read from the query cache, so it works in portals like the task sheet. */
export const isProjectReadOnly = (projectId: string | undefined): boolean => {
  if (!projectId) return false;

  const project = findInCache<EnrichedProject>('project', projectId);
  if (project) return project.membership?.role === 'guest';

  // Known only through the public endpoint, which has no membership.
  if (queryClient.getQueryData(projectQueryKeys.detail.public(projectId))) return true;

  return false;
};

const subscribeToQueryCache = (onStoreChange: () => void) => queryClient.getQueryCache().subscribe(onStoreChange);

/** Re-renders only when this project's read-only answer flips. */
export const useIsProjectReadOnly = (projectId: string | undefined): boolean => {
  const getSnapshot = () => isProjectReadOnly(projectId);
  return useSyncExternalStore(subscribeToQueryCache, getSnapshot, getSnapshot);
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
