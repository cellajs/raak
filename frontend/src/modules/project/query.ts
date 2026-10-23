import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type AssignProjectWorkspaceData,
  type AssignProjectWorkspaceResponse,
  assignProjectWorkspace,
  type CreateProjectsData,
  createProjects,
  type DeleteProjectsData,
  deleteProjects,
  type GetProjectsData,
  getProject,
  getProjects,
  getPublicProject,
  type MoveProjectToWorkspaceData,
  type MoveProjectToWorkspaceResponse,
  moveProjectToWorkspace,
  type Project,
  type RemoveProjectWorkspaceData,
  type RemoveProjectWorkspaceResponse,
  removeProjectWorkspace,
  type UpdateProjectData,
  type UpdateProjectResponse,
  updateProject,
} from 'sdk';
import { appConfig } from 'shared';
import { ApiError } from '~/lib/api';
import { meKeys } from '~/modules/me/query';
import { addMyMembershipCache, getApiIncludedMembership, upsertMyMembershipCache } from '~/modules/memberships/query-mutations';
import type { EnrichedProject } from '~/modules/project/types';
import { workspaceQueryKeys } from '~/modules/workspace/query';
import { cacheCreate, cacheRemove, cacheUpdate, removeDetailQueriesOnceUnobserved } from '~/query/basic/cache-mutations';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys } from '~/query/basic/entity-query-registry';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { defaultOrderFor } from '~/query/basic/get-query-key-sort-order';
import { offsetPaging, pageQuery, refetchOnMountForIncluded } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation } from '~/query/basic/invalidation-helpers';
import { getSimilarQueries } from '~/query/basic/mutate-query';
import { preserveIncluded } from '~/query/basic/preserve-included';
import type { MutationData } from '~/query/types';

type ProjectFilters = Omit<NonNullable<GetProjectsData['query']>, 'limit' | 'offset'>;

const keys = createEntityKeys<ProjectFilters>('project');

// Register query keys for dynamic lookup in stream handlers
registerEntityQueryKeys('project', keys);

/** Defines React Query cache keys for project. */
export const projectQueryKeys = {
  ...keys,
  detail: { ...keys.detail, public: (id: string) => ['project', 'detail', 'public', id] as const },
};

const findProjectInCache = createCacheFinder<Project>('project');

/**
 * Find a project in cache by id or slug. Slug matches are scoped to the given tenant.
 * Returns `EnrichedProject` because cache entries are populated by the enrichment pipeline.
 */
export const findProjectByIdOrSlug = (idOrSlug: string, tenantId: string): EnrichedProject | undefined =>
  findProjectInCache((p) => p.id === idOrSlug || (p.slug === idOrSlug && p.tenantId === tenantId)) as EnrichedProject | undefined;

type ProjectsListParams = ProjectFilters & { limit?: number };

/**
 * Paginated projects infinite query. `include` is deliberately not part of the cache key because
 * queries with/without counts share one cache for offline behavior; the most recent fetch wins.
 */
export const projectsListQueryOptions = (params: ProjectsListParams = {}) => {
  const {
    q = '',
    sort = 'displayOrder',
    order = defaultOrderFor(sort),
    organizationId,
    workspaceId,
    relatableUserId,
    role,
    excludeArchived,
    scope,
    include,
    limit = appConfig.requestLimits.projects,
  } = params;

  // Exclude `include` from cache key so queries with/without counts share the same cache
  const filters = { q, sort, order, organizationId, workspaceId, relatableUserId, role, excludeArchived, scope };

  return infiniteQueryOptions({
    queryKey: keys.list.filtered(filters),
    ...offsetPaging(limit, async (offset, signal) => {
      const result = await getProjects({ query: { ...filters, include, ...pageQuery(limit, offset) }, signal });
      // Cache entries are populated by the enrichment pipeline (membership/can/ancestorSlugs).
      return result as { items: EnrichedProject[]; total: number };
    }),
    refetchOnMount: refetchOnMountForIncluded(include),
  });
};

export const projectQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: keys.detail.byId(id),
    queryFn: async () => (await getProject({ path: { id, organizationId, tenantId } })) as EnrichedProject,
    placeholderData: () => findProjectByIdOrSlug(id, tenantId),
    structuralSharing: preserveIncluded,
  });

export const publicProjectQueryOptions = (id: string, bySlug = false) =>
  queryOptions({
    queryKey: projectQueryKeys.detail.public(id),
    queryFn: () => getPublicProject({ path: { id }, query: bySlug ? { slug: true } : undefined }),
    retry: false,
  });

export const useProjectCreateMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<Project, ApiError, MutationData<CreateProjectsData>>({
    mutationKey: keys.create,
    mutationFn: async ({ path, body, query }) => {
      const result = await createProjects({ path, body, query });
      if (!result.data.length) throw new ApiError({ status: 422, type: 'create_resource', entityType: 'project', severity: 'error' });
      return result.data[0] as Project;
    },
    onSuccess: (createdProject) => {
      const membership = getApiIncludedMembership(createdProject);
      if (membership) addMyMembershipCache(membership);
      cacheCreate(listKey, [createdProject]);
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

export const useProjectUpdateMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<UpdateProjectResponse, ApiError, MutationData<UpdateProjectData>>({
    mutationKey: keys.update,
    mutationFn: ({ path, body }) => updateProject({ path, body }),
    onSuccess: (updatedProject) => {
      cacheUpdate(listKey, [updatedProject]);
      queryClient.invalidateQueries({ queryKey: keys.detail.base });
      // Directly update detail cache so beforeLoad doesn't use stale slug for URL rewrite
      queryClient.setQueryData(keys.detail.byId(updatedProject.id), updatedProject);
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
    gcTime: 1000 * 10,
  });
};

export const useProjectDeleteMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<void, ApiError, MutationData<DeleteProjectsData> & { projects: Project[] }>({
    mutationKey: keys.delete,
    mutationFn: async ({ path, body }) => {
      await deleteProjects({ path, body });
    },
    onSuccess: (_, { projects }) => {
      cacheRemove(listKey, projects);
      removeDetailQueriesOnceUnobserved(
        queryClient,
        keys.detail.base,
        projects.map(({ id }) => id),
      );
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

const assignKey = [...keys.update, 'assign'] as const;

/** Provides the React Query mutation for assign project. */
export const useAssignProjectMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<AssignProjectWorkspaceResponse, ApiError, MutationData<AssignProjectWorkspaceData>>({
    mutationKey: assignKey,
    mutationFn: ({ path, query }) => assignProjectWorkspace({ path, query }),
    onSuccess: (newProject) => {
      const membership = getApiIncludedMembership(newProject);
      if (membership) upsertMyMembershipCache(membership);

      cacheUpdate(listKey, [newProject]);
    },
    onSettled: (_data, _error, { path: { organizationId }, query: { workspaceId } }) => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);

      // Assigning several projects runs one mutation each: the last to settle refreshes for all of them.
      if (queryClient.isMutating({ mutationKey: assignKey }) > 1) return;

      queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.detail.byId(workspaceId) });

      // Force-refresh affected project lists so assignment labels are fresh on immediate reopen.
      const projectListQueries = getSimilarQueries([...keys.list.base, { organizationId }]);
      for (const [queryKey] of projectListQueries) {
        queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
      }

      queryClient.invalidateQueries({ queryKey: keys.detail.base });
      queryClient.invalidateQueries({ queryKey: meKeys.memberships });
    },
  });
};

/** Provides the React Query mutation for project move. */
export const useProjectMoveMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<MoveProjectToWorkspaceResponse, ApiError, MutationData<MoveProjectToWorkspaceData> & { currentWorkspaceId: string }>({
    mutationKey: keys.update,
    mutationFn: ({ path, query }) => moveProjectToWorkspace({ path, query }),
    onSuccess: (movedProject, { query: { workspaceId }, currentWorkspaceId }) => {
      const currentQueryKey = workspaceQueryKeys.detail.byId(currentWorkspaceId);
      queryClient.invalidateQueries({ queryKey: currentQueryKey });

      const newQueryKey = workspaceQueryKeys.detail.byId(workspaceId);
      queryClient.invalidateQueries({ queryKey: newQueryKey });

      const membership = getApiIncludedMembership(movedProject);
      if (membership) upsertMyMembershipCache(membership);

      cacheUpdate(listKey, [movedProject]);
      queryClient.invalidateQueries({ queryKey: keys.detail.base });
      queryClient.invalidateQueries({ queryKey: meKeys.memberships });
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

export const useProjectRemoveWorkspaceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation<RemoveProjectWorkspaceResponse, ApiError, MutationData<RemoveProjectWorkspaceData>>({
    mutationFn: ({ path }) => removeProjectWorkspace({ path }),
    onSuccess: (updatedProject) => {
      const membership = getApiIncludedMembership(updatedProject);
      if (membership) upsertMyMembershipCache(membership);
      queryClient.invalidateQueries({ queryKey: keys.list.base, refetchType: 'active' });
    },
  });
};
