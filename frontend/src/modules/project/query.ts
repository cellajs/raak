import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import type { Project } from 'sdk';
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
  type UpdateProjectData,
  type UpdateProjectResponse,
  updateProject,
} from 'sdk';
import { appConfig } from 'shared';
import { toast } from 'sonner';
import { ApiError } from '~/lib/api';
import { toaster } from '~/modules/common/toaster/toaster';
import { labelQueryKeys } from '~/modules/label/query';
import { meKeys } from '~/modules/me/query';
import {
  addMyMembershipCache,
  getApiIncludedMembership,
  upsertMyMembershipCache,
} from '~/modules/memberships/query-mutations';
import type { EnrichedProject } from '~/modules/project/types';
import { workspaceQueryKeys } from '~/modules/workspace/query';
import { cacheCreate, cacheRemove, cacheUpdate } from '~/query/basic/cache-mutations';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys } from '~/query/basic/entity-query-registry';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { baseInfiniteQueryOptions } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation } from '~/query/basic/invalidation-helpers';
import { getSimilarQueries } from '~/query/basic/mutate-query';
import { preserveIncluded } from '~/query/basic/preserve-included';
import type { MutationData } from '~/query/types';

type ProjectFilters = Omit<GetProjectsData['query'], 'limit' | 'offset'>;

const keys = createEntityKeys<ProjectFilters>('project');

// Register keys for SSE/stream handler support
registerEntityQueryKeys('project', keys);

/**
 * Project query keys.
 */
export const projectQueryKeys = {
  ...keys,
  detail: {
    ...keys.detail,
    public: (id: string) => ['project', 'detail', 'public', id] as const,
  },
};

const findProjectInCache = createCacheFinder<Project>('project');

/**
 * Find a project in cache by id or slug. Slug matches are scoped to the given tenant.
 * Returns `EnrichedProject` because cache entries are populated by the enrichment pipeline.
 */
export const findProjectByIdOrSlug = (idOrSlug: string, tenantId: string): EnrichedProject | undefined =>
  findProjectInCache((p) => p.id === idOrSlug || (p.slug === idOrSlug && p.tenantId === tenantId)) as
    | EnrichedProject
    | undefined;

type ProjectsListParams = Omit<NonNullable<GetProjectsData['query']>, 'limit' | 'offset'> & {
  limit?: number;
};

/**
 * Infinite query options to get a paginated list of projects.
 * `include` is not part of the cache key; queries with/without counts share the same cache.
 * for seamless offline behavior. The most recent fetch determines what's cached.
 */
export const projectsListQueryOptions = (params: ProjectsListParams = {}) => {
  const {
    q = '',
    sort = 'displayOrder',
    order = sort === 'displayOrder' ? 'asc' : 'desc',
    organizationId,
    workspaceId,
    relatableUserId,
    role,
    excludeArchived,
    include,
    limit: baseLimit = appConfig.requestLimits.projects,
  } = params;

  const limit = String(baseLimit);

  // Exclude `include` from cache key so queries with/without counts share the same cache
  const keyFilters = { q, sort, order, organizationId, workspaceId, relatableUserId, role, excludeArchived };

  const queryKey = keys.list.filtered(keyFilters);
  const baseQuery = { ...keyFilters, limit, include };

  return infiniteQueryOptions({
    queryKey,
    queryFn: async ({ pageParam: { page, offset: _offset }, signal }) => {
      const offset = String(_offset ?? (page ?? 0) * Number(limit));

      const result = await getProjects({
        query: { ...baseQuery, offset },
        signal,
      });
      // Cache entries are populated by the enrichment pipeline (membership/can/ancestorSlugs).
      return result as { items: EnrichedProject[]; total: number };
    },
    ...baseInfiniteQueryOptions,
    refetchOnMount: true,
  });
};

/**
 * Query options for a single project by id or slug.
 */
export const projectQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: keys.detail.byId(id),
    queryFn: async () => (await getProject({ path: { id, organizationId, tenantId } })) as EnrichedProject,
    placeholderData: () => findProjectByIdOrSlug(id, tenantId),
    structuralSharing: preserveIncluded,
  });

// Query Options to get a public project by id or slug
export const publicProjectQueryOptions = (id: string, bySlug = false) =>
  queryOptions({
    queryKey: projectQueryKeys.detail.public(id),
    queryFn: () => getPublicProject({ path: { id }, query: bySlug ? { slug: true } : undefined }),
    retry: false,
  });

/**
 * Custom hook to create a new project.
 * This hook provides the functionality to create a new project.
 *
 * @returns The mutation hook for creating an project.
 */
export const useProjectCreateMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<Project, ApiError, MutationData<CreateProjectsData>>({
    mutationKey: keys.create,
    mutationFn: async ({ path, body, query }) => {
      const result = await createProjects({ path, body, query });
      if (!result.data.length) throw new ApiError({ status: 422, type: 'create_resource' });
      return result.data[0] as Project;
    },
    onSuccess: (createdProject) => {
      toaster(t('c:success.create_resource', { resource: t('c:project') }), 'success');
      const membership = getApiIncludedMembership(createdProject);
      if (membership) addMyMembershipCache(membership);
      cacheCreate(listKey, [createdProject]);
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

/**
 * Custom hook to update an existing project.
 * This hook provides the functionality to update an project. After a successful update,
 * it updates the local cache and invalidates relevant queries to keep the data fresh.
 *
 * @returns The mutation hook for updating an project.
 */
export const useProjectUpdateMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<UpdateProjectResponse, ApiError, MutationData<UpdateProjectData>>({
    mutationKey: keys.update,
    mutationFn: ({ path, body }) => updateProject({ path, body }),
    onSuccess: (updatedProject) => {
      toaster(t('c:success.update_resource', { resource: t('c:project') }), 'success');
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

/**
 * Custom hook to delete projects.
 * This hook provides the functionality to delete one or more projects.
 *
 * @returns The mutation hook for deleting projects.
 */
export const useProjectDeleteMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<void, ApiError, MutationData<DeleteProjectsData> & { projects: Project[] }>({
    mutationKey: keys.delete,
    mutationFn: async ({ path, body }) => {
      await deleteProjects({ path, body });
    },
    onSuccess: (_, { projects, path: { organizationId } }) => {
      const deleteText =
        projects.length === 1
          ? t('c:success.delete_resource', { resource: t('c:project') })
          : t('c:success.delete_counted_resources', {
              count: projects.length,
              resources: t('c:project_other').toLowerCase(),
            });
      toaster(deleteText, 'success');

      // Invalidate labels table queries
      const labelsQueries = getSimilarQueries([...labelQueryKeys.list.base, { organizationId }]);
      for (const [queryKey] of labelsQueries) queryClient.invalidateQueries({ queryKey });

      cacheRemove(listKey, projects);
      queryClient.invalidateQueries({ queryKey: keys.detail.base });
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

export const useAssignProjectMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<
    AssignProjectWorkspaceResponse,
    ApiError,
    MutationData<AssignProjectWorkspaceData> & { workspaceName: string }
  >({
    mutationKey: keys.update,
    mutationFn: ({ path, query }) => assignProjectWorkspace({ path, query }),
    onSuccess: (newProject, { path: { organizationId }, query: { workspaceId }, workspaceName }) => {
      toast.success(
        t('c:success.assign_resource', {
          resource: `${t('c:project')} ${newProject.name}`,
          secondResource: workspaceName,
        }),
      );

      const queryKey = workspaceQueryKeys.detail.byId(workspaceId);
      queryClient.invalidateQueries({ queryKey });

      // Invalidate labels table queries
      const labelsQueries = getSimilarQueries([...labelQueryKeys.list.base, { organizationId }]);
      for (const [queryKey] of labelsQueries) queryClient.invalidateQueries({ queryKey });

      // Force-refresh affected project lists so assignment labels are fresh on immediate reopen.
      const projectListQueries = getSimilarQueries([...keys.list.base, { organizationId }]);
      for (const [queryKey] of projectListQueries) {
        queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
      }

      const membership = getApiIncludedMembership(newProject);
      if (membership) upsertMyMembershipCache(membership);

      cacheUpdate(listKey, [newProject]);
      queryClient.invalidateQueries({ queryKey: keys.detail.base });
      queryClient.invalidateQueries({ queryKey: meKeys.memberships });
    },
    onSettled: () => {
      invalidateIfLastMutation(queryClient, keys.all, listKey);
    },
  });
};

export const useProjectMoveMutation = () => {
  const queryClient = useQueryClient();
  const listKey = keys.list.base;

  return useMutation<
    MoveProjectToWorkspaceResponse,
    ApiError,
    MutationData<MoveProjectToWorkspaceData> & { currentWorkspaceId: string }
  >({
    mutationKey: keys.update,
    mutationFn: ({ path, query }) => moveProjectToWorkspace({ path, query }),
    onSuccess: (movedProject, { path: { organizationId }, query: { workspaceId }, currentWorkspaceId }) => {
      toaster(t('c:success.project_moved'), 'success');

      const currentQueryKey = workspaceQueryKeys.detail.byId(currentWorkspaceId);
      queryClient.invalidateQueries({ queryKey: currentQueryKey });

      const newQueryKey = workspaceQueryKeys.detail.byId(workspaceId);
      queryClient.invalidateQueries({ queryKey: newQueryKey });

      // Invalidate labels table queries
      const labelsQueries = getSimilarQueries([...labelQueryKeys.list.base, { organizationId }]);
      for (const [queryKey] of labelsQueries) queryClient.invalidateQueries({ queryKey });

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
