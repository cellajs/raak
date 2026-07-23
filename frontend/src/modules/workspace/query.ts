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
import { cacheCreate, cacheRemove, cacheUpdate, removeDetailQueriesById } from '~/query/basic/cache-mutations';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys } from '~/query/basic/entity-query-registry';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { baseInfiniteQueryOptions } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation } from '~/query/basic/invalidation-helpers';
import { preserveIncluded } from '~/query/basic/preserve-included';
import type { MutationData } from '~/query/types';

type WorkspaceFilters = Omit<GetWorkspacesData['query'], 'limit' | 'offset'>;

const keys = createEntityKeys<WorkspaceFilters>('workspace');

// Register query keys for dynamic lookup in stream handlers
registerEntityQueryKeys('workspace', keys);

export const workspaceQueryKeys = keys;

const findWorkspaceInCache = createCacheFinder<Workspace>('workspace');

/** Find a workspace in cache by id or slug. Slug matches are scoped to the given tenant. */
export const findWorkspaceByIdOrSlug = (idOrSlug: string, tenantId: string): Workspace | undefined =>
  findWorkspaceInCache((ws) => ws.id === idOrSlug || (ws.slug === idOrSlug && ws.tenantId === tenantId));

type WorkspacesListParams = Omit<NonNullable<GetWorkspacesData['query']>, 'limit' | 'offset'> & {
  limit?: number;
};

/** Paginated workspaces infinite query. `include` is deliberately not part of the cache key. */
export const workspacesListQueryOptions = (params: WorkspacesListParams = {}) => {
  const {
    q = '',
    sort = 'displayOrder',
    order = sort === 'displayOrder' ? 'asc' : 'desc',
    organizationId,
    role,
    excludeArchived,
    include,
    limit = appConfig.requestLimits.default,
  } = params;

  const filters = { q, sort, order, organizationId, role, excludeArchived };
  const requestQuery = { ...filters, include, limit: String(limit) };

  return infiniteQueryOptions({
    queryKey: keys.list.filtered(filters),
    queryFn: ({ pageParam: { page, offset }, signal }) => {
      const requestOffset = String(offset ?? (page ?? 0) * limit);

      return getWorkspaces({
        query: { ...requestQuery, offset: requestOffset },
        signal,
      });
    },
    ...baseInfiniteQueryOptions,
    refetchOnMount: true,
  });
};

/** Query options for a single workspace by id or slug. */
export const workspaceQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: keys.detail.byId(id),
    queryFn: () => getWorkspace({ path: { id, organizationId, tenantId } }),
    placeholderData: () => findWorkspaceByIdOrSlug(id, tenantId),
    structuralSharing: preserveIncluded,
  });

/** Mutation hook for creating a new workspace. */
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
      toaster.success(t('c:success.create_resource', { resource: t('c:workspace') }));
      const membership = getApiIncludedMembership(createdWorkspace);
      if (membership) addMyMembershipCache(membership);
      cacheCreate(listKey, [createdWorkspace]);
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

/** Mutation hook for updating an existing workspace. */
export const useUpdateWorkspaceMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<Workspace, ApiError, MutationData<UpdateWorkspaceData>>({
    mutationKey: keys.update,
    mutationFn: ({ path, body }) => updateWorkspace({ path, body }),
    onSuccess: (updatedWorkspace) => {
      toaster.success(t('c:success.update_resource', { resource: t('c:workspace') }));
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

/** Mutation hook for deleting workspaces. */
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

      toaster.success(message);
      cacheRemove(listKey, workspaces);
      removeDetailQueriesById(
        queryClient,
        keys.detail.base,
        workspaces.map(({ id }) => id),
      );
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};
