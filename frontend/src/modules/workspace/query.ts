import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import type { Workspace } from 'sdk';
import {
  type CreateWorkspacesData,
  createWorkspaces,
  type DeleteWorkspacesData,
  deleteWorkspaces,
  type GetWorkspacesData,
  getWorkspace,
  getWorkspaces,
  type UpdateWorkspaceData,
  updateWorkspace,
} from 'sdk';
import { appConfig } from 'shared';
import { ApiError } from '~/lib/api';
import { toaster } from '~/modules/common/toaster/toaster';
import { addMyMembershipCache, getApiIncludedMembership } from '~/modules/memberships/query-mutations';
import { cacheCreate, cacheRemove, cacheUpdate } from '~/query/basic/cache-mutations';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys } from '~/query/basic/entity-query-registry';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { baseInfiniteQueryOptions } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation } from '~/query/basic/invalidation-helpers';
import { preserveIncluded } from '~/query/basic/preserve-included';
import type { MutationData } from '~/query/types';

type WorkspaceFilters = Omit<GetWorkspacesData['query'], 'limit' | 'offset'>;

const keys = createEntityKeys<WorkspaceFilters>('workspace');

// Register keys for SSE/stream handler support
registerEntityQueryKeys('workspace', keys);

/**
 * Workspace query keys.
 */
export const workspaceQueryKeys = keys;

const findWorkspaceInCache = createCacheFinder<Workspace>('workspace');

/** Find a workspace in cache by id or slug. Slug matches are scoped to the given tenant. */
export const findWorkspaceByIdOrSlug = (idOrSlug: string, tenantId: string): Workspace | undefined =>
  findWorkspaceInCache((ws) => ws.id === idOrSlug || (ws.slug === idOrSlug && ws.tenantId === tenantId));

type WorkspacesListParams = Omit<NonNullable<GetWorkspacesData['query']>, 'limit' | 'offset'> & {
  limit?: number;
};

/**
 * Infinite query options to get a paginated list of workspaces.
 */
export const workspacesListQueryOptions = (params: WorkspacesListParams = {}) => {
  const {
    q = '',
    sort = 'displayOrder',
    order = sort === 'displayOrder' ? 'asc' : 'desc',
    organizationId,
    role,
    excludeArchived,
    include,
    limit: baseLimit = appConfig.requestLimits.default,
  } = params;

  const limit = String(baseLimit);

  const keyFilters = { q, sort, order, organizationId, role, excludeArchived };

  const queryKey = keys.list.filtered(keyFilters);
  const baseQuery = { ...keyFilters, include, limit };

  return infiniteQueryOptions({
    queryKey,
    queryFn: async ({ pageParam: { page, offset: _offset }, signal }) => {
      const offset = String(_offset ?? (page ?? 0) * Number(limit));

      return getWorkspaces({
        query: { ...baseQuery, offset },
        signal,
      });
    },
    ...baseInfiniteQueryOptions,
    refetchOnMount: true,
  });
};

/**
 * Query options for a single workspace by id or slug.
 */
export const workspaceQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: keys.detail.byId(id),
    queryFn: () => getWorkspace({ path: { id, organizationId, tenantId } }),
    placeholderData: () => findWorkspaceByIdOrSlug(id, tenantId),
    structuralSharing: preserveIncluded,
  });
/**
 * Custom hook to create a new workspace.
 * This hook provides the functionality to create a new workspace.
 *
 * @returns The mutation hook for creating an workspace.
 */
export const useWorkspaceCreateMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<Workspace, ApiError, MutationData<CreateWorkspacesData>>({
    mutationKey: keys.create,
    mutationFn: async ({ path, body }) => {
      const result = await createWorkspaces({ path, body });
      if (!result.data.length) throw new ApiError({ status: 422, type: 'create_resource' });
      return result.data[0] as Workspace;
    },
    onSuccess: (createdWorkspace) => {
      toaster(t('c:success.create_resource', { resource: t('c:workspace') }), 'success');
      const membership = getApiIncludedMembership(createdWorkspace);
      if (membership) addMyMembershipCache(membership);
      cacheCreate(listKey, [createdWorkspace]);
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

/**
 * Custom hook to update an existing workspace.
 * This hook provides the functionality to update an workspace. After a successful update,
 * it updates the local cache and invalidates relevant queries to keep the data fresh.
 *
 * @returns The mutation hook for updating an workspace.
 */
export const useUpdateWorkspaceMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<Workspace, ApiError, MutationData<UpdateWorkspaceData>>({
    mutationKey: keys.update,
    mutationFn: ({ path, body }) => updateWorkspace({ path, body }),
    onSuccess: (updatedWorkspace) => {
      toaster(t('c:success.update_resource', { resource: t('c:workspace') }), 'success');
      cacheUpdate(listKey, [updatedWorkspace]);
      queryClient.invalidateQueries({ queryKey: keys.detail.base });
      // Directly update detail cache so beforeLoad doesn't use stale slug for URL rewrite
      queryClient.setQueryData(keys.detail.byId(updatedWorkspace.id), updatedWorkspace);
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
    gcTime: 1000 * 10,
  });
};

/**
 * Custom hook to delete workspaces.
 * This hook provides the functionality to delete one or more workspaces.
 *
 * @returns The mutation hook for deleting workspaces.
 */
export const useWorkspaceDeleteMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<void, ApiError, MutationData<DeleteWorkspacesData> & { workspaces: Workspace[] }>({
    mutationKey: keys.delete,
    mutationFn: async ({ path, body }) => {
      await deleteWorkspaces({ path, body });
    },
    onSuccess: (_, { workspaces }) => {
      const message =
        workspaces.length > 1
          ? t('c:success.delete_counted_resources', {
              count: workspaces.length,
              resources: t('c:workspace_other').toLowerCase(),
            })
          : t('c:success.delete_resource', { resource: t('c:workspace') });

      toaster(message, 'success');
      cacheRemove(listKey, workspaces);
      for (const ws of workspaces) queryClient.removeQueries({ queryKey: keys.detail.byId(ws.id) });
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};
