import type { GetNextPageParamFunction, QueryClient } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTasksData, GetTasksData, UpdateTaskData, UserMinimalBase } from 'sdk';
import { createTasks, deleteTasks, getTask, getTasks, updateTask } from 'sdk';
import { zTask } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import { registerYjsOwnedFields } from '~/modules/common/blocknote/yjs-editor';
import { labelQueryKeys } from '~/modules/label/query';
import { deriveDescriptionCounts } from '~/modules/task/helpers/derive-description-props';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { boardAcceptedCutOff } from '~/modules/task/task-properties';
import type { Task, TaskLabel } from '~/modules/task/types';
import { cacheCreate, cacheRemove, cacheUpdate } from '~/query/basic/cache-mutations';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys, SYNC_CHUNK_SIZE } from '~/query/basic/entity-query-registry';
import { fetchAllPages } from '~/query/basic/fetch-all-pages';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { baseInfiniteQueryOptions } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation, removePendingMutations } from '~/query/basic/invalidation-helpers';
import { syncStaleTime } from '~/query/basic/sync-stale-config';
import { addMutationRegistrar } from '~/query/mutation-registry';
import { isArrayDelta } from '~/query/offline/array-delta';
import { squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
import { createStxForCreate, createStxForDelete, createStxForUpdate } from '~/query/offline/stx-utils';
import { mergeServerResponse } from '~/query/offline/update-success-utils';
import { getRouteOrgId, getRouteTenantId } from '~/query/realtime/sync-priority';
import type { InfiniteQueryData, PageParams, QueryData, QueryOrgContext } from '~/query/types';
import { createResourceError } from '~/utils/resource-error';

// --- Types ---

export type GetTasksParam = GetTasksData['path'] & Omit<NonNullable<GetTasksData['query']>, 'limit' | 'offset'>;
export type BaseTasksQueryParam = Pick<GetTasksParam, 'workspaceId' | 'projectId' | 'organizationId' | 'tenantId'>;

/** Derive task query params from entity objects instead of constructing manually */
export const deriveTasksQueryParams = (
  workspace?: { id: string; organizationId: string; tenantId: string },
  project?: { id: string; organizationId: string; tenantId: string },
): BaseTasksQueryParam => {
  if (workspace)
    return { tenantId: workspace.tenantId, organizationId: workspace.organizationId, workspaceId: workspace.id };
  if (project) return { tenantId: project.tenantId, organizationId: project.organizationId, projectId: project.id };
  throw new Error('Either workspace or project is required to derive task query params');
};

// Extract inner data shape for mutation variables
type CreateTaskDataInner = Omit<CreateTasksData['body'][number], 'stx' | 'tenantId'>;
type BaseCreateParams = CreateTaskDataInner & { isSheet?: boolean };
type UpdateTaskBody = NonNullable<UpdateTaskData['body']>;
type UpdateTaskDataOps = Omit<UpdateTaskBody, 'stx'>;
type BaseUpdateParams = Pick<UpdateTaskData['path'], 'id'> & UpdateTaskDataOps;

/** Client-only fields for building correct optimistic cache shape (not in API schema) */
type OptimisticCacheFields = {
  /** Client-computed summary (backend regenerates server-side) */
  summary?: string;
  summaryLength?: number;
  fullLabels: TaskLabel[];
  fullAssignedTo: UserMinimalBase[];
};

type TaskCreateMutationFnVariables = BaseCreateParams & OptimisticCacheFields;

export type TaskUpdateMutationFnVariables = BaseUpdateParams & Partial<OptimisticCacheFields>;

type TasksDeleteMutationFnVariables = {
  tasksToDelete: Task[];
};

export type TasksQueryData = QueryData<Task>;
export type TasksInfiniteQueryData = InfiniteQueryData<Task>;

// --- Query keys ---

/**
 * Filters for task list queries. Derived from the SDK query type so `sort`/`order`/`matchMode`
 * carry the API's literal unions instead of bare `string`.
 */
type TaskListFilters = Pick<GetTasksParam, 'projectId' | 'workspaceId' | 'q' | 'sort' | 'order' | 'matchMode'>;
/** Separate key space for public (unauthenticated) task queries */
type PublicTaskListFilters = TaskListFilters & { publicAt: true };

const baseKeys = createEntityKeys<TaskListFilters>('task');

/**
 * Task query keys.
 *
 * Key hierarchy:
 *   ['task', 'list']                                   all tasks (broadest prefix)
 *   ['task', 'list', organizationId]                   all tasks for one org
 *   ['task', 'list', organizationId, {projectId, filters}] specific query
 *
 *   ['task', 'detail', id]                             single task detail
 *   ['task', 'detail', 'public', id]                   public task detail
 *
 * Public queries use a dedicated factory to keep them isolated.
 */
export const taskKeys = {
  ...baseKeys,
  list: {
    ...baseKeys.list,
    /** Override: org-scoped filtered key for prefix matching */
    filtered: (organizationId: string, filters: TaskListFilters) => ['task', 'list', organizationId, filters] as const,
  },
  detail: {
    ...baseKeys.detail,
    public: (id: string) => ['task', 'detail', 'public', id] as const,
  },
  /** Public task list keys (separate from authenticated queries) */
  publicList: {
    base: ['task', 'public-list'] as const,
    filtered: (filters: PublicTaskListFilters) => ['task', 'public-list', filters] as const,
  },
};

registerEntityQueryKeys('task', taskKeys, (organizationId, tenantId, seqCursor, pathPrefix) => {
  return getTasks({
    path: { tenantId: tenantId!, organizationId: organizationId! },
    query: { seqCursor, pathPrefix, limit: String(SYNC_CHUNK_SIZE) },
  });
});

/**
 * Fields derived from the task description (computed server-side on description writes).
 * Used both to merge server-computed values after a description mutation and to protect
 * these fields from stale SSE overwrites while a Yjs editor is active.
 */
export const TASK_DERIVED_DESCRIPTION_FIELDS = [
  'summary',
  'summaryLength',
  'expandable',
  'checkboxCount',
  'checkedCount',
  'attachmentCount',
] as const;

// Register Yjs-owned fields; SSE updates skip these while a Yjs editor is active.
registerYjsOwnedFields('task', ['description', ...TASK_DERIVED_DESCRIPTION_FIELDS]);

const tasksMutationKeyBase = ['task'] as const;
const handleError = createResourceError('task');

// --- Helpers ---

/** Find a task in detail or list cache. */
const findTaskInCache = createCacheFinder<Task>('task');

export const getTasksNextPageParam: GetNextPageParamFunction<PageParams, TasksQueryData> = (lastPage, allPages) => {
  const { total } = lastPage;
  const fetchedCount = allPages.reduce((acc, page) => acc + page.items.length, 0);
  if (fetchedCount >= total) return undefined;
  return { page: allPages.length, offset: fetchedCount };
};

const transformUpdateData = <T extends TaskUpdateMutationFnVariables>(variables: T) => {
  const {
    id,
    ops,
    summary: _summary,
    summaryLength: _summaryLength,
    fullLabels: _fullLabels,
    fullAssignedTo: _fullAssignedTo,
    ...rest
  } = variables;
  // Generate HLC timestamps only for scalar fields (AWSet fields are commutative)
  const scalarFieldNames = ops ? Object.keys(ops).filter((k) => !isArrayDelta(ops[k as keyof typeof ops])) : [];
  const stx = createStxForUpdate(scalarFieldNames);
  return {
    id,
    ops,
    stx,
    ...rest,
  };
};

// --- Mutation executors ---
// Shared by the mutation hooks and the offline mutation defaults below, so a mutation
// resumed from persistence replays with exactly the variable shape the hooks fire with.

const executeTaskCreate = async (
  { tenantId, organizationId }: QueryOrgContext,
  { fullLabels: _fl, fullAssignedTo: _fa, isSheet: _is, summary: _summary, ...data }: TaskCreateMutationFnVariables,
) => {
  const stx = createStxForCreate();
  const result = await createTasks({ body: [{ ...data, stx }], path: { organizationId, tenantId } });
  return result.data[0];
};

const executeTaskUpdate = async (
  { tenantId, organizationId }: QueryOrgContext,
  variables: TaskUpdateMutationFnVariables,
) => {
  const { id, ...body } = transformUpdateData(variables);
  return await updateTask({ body, path: { id, organizationId, tenantId } });
};

const executeTasksDelete = async (
  { tenantId, organizationId }: QueryOrgContext,
  { tasksToDelete }: TasksDeleteMutationFnVariables,
) => {
  const ids = tasksToDelete.map(({ id }) => id);
  const stx = createStxForDelete();
  const response = await deleteTasks({ body: { ids, stx }, path: { organizationId, tenantId } });
  return response.rejectedIds.length === 0;
};

/** Resolve org context for a mutation resumed from persistence (persisted variables carry no context). */
const resolveOrgContext = (cached?: { organizationId: string; tenantId: string } | null): QueryOrgContext => {
  const organizationId = cached?.organizationId ?? getRouteOrgId();
  const tenantId = cached?.tenantId ?? getRouteTenantId();
  if (!organizationId || !tenantId) throw new Error('Cannot resolve organizationId/tenantId for task mutation');
  return { organizationId, tenantId };
};

// --- Query options ---

export const taskQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: taskKeys.detail.byId(id),
    queryFn: async () => {
      return getTask({
        path: { id, organizationId, tenantId },
      });
    },
    initialData: () => findTaskInCache(id),
  });

/**
 * Canonical task query: one flat query per project scope.
 * Fetches all tasks for a project, stored at taskKeys.list.home(organizationId, projectId).
 * Board/table derive views via select() or client-side filtering.
 * Sync (SSE + delta fetch) keeps this fresh; staleTime follows sync liveness.
 */
export const tasksCanonicalOptions = ({
  organizationId,
  tenantId,
  projectId,
}: {
  organizationId: string;
  tenantId: string;
  projectId: string;
}) => {
  const limit = appConfig.requestLimits.tasks;

  return queryOptions({
    queryKey: taskKeys.list.home(organizationId, projectId),
    queryFn: async () => {
      return fetchAllPages(
        ({ limit, offset }) =>
          getTasks({
            path: { organizationId, tenantId },
            query: { projectId, limit, offset, acceptedCutOff: boardAcceptedCutOff },
          }),
        limit,
      );
    },
    staleTime: syncStaleTime,
  });
};

/** Default sort/order/match for the tasks table, single-sourced so the options factory and the
 *  lightweight count snapshot (use-tasks-total) can't drift on their query key. */
export const tasksTableQueryDefaults = { sort: 'createdAt', order: 'desc', matchMode: 'all' } as const;

/** The tasks-table infinite query key. Extracted so use-tasks-total can read the key directly
 *  instead of building the whole options object (queryFn/getNextPageParam closures) to discard it. */
export const tasksTableQueryKey = ({
  q,
  sort = tasksTableQueryDefaults.sort,
  order = tasksTableQueryDefaults.order,
  matchMode = tasksTableQueryDefaults.matchMode,
  projectId,
  workspaceId,
  organizationId,
}: Omit<GetTasksParam, 'acceptedCutOff' | 'tenantId'>) =>
  taskKeys.list.filtered(organizationId, { projectId, workspaceId, sort, order, matchMode, q });

export const tasksTableQueryOptions = ({
  q,
  sort = tasksTableQueryDefaults.sort,
  order = tasksTableQueryDefaults.order,
  matchMode = tasksTableQueryDefaults.matchMode,
  projectId,
  workspaceId,
  organizationId,
  tenantId,
  limit: baseLimit = appConfig.requestLimits.tasksTable,
}: Omit<GetTasksParam, 'acceptedCutOff'> & { limit?: number }) => {
  const limit = String(baseLimit);
  const { initialPageParam } = baseInfiniteQueryOptions;

  const query = { q, sort, order, organizationId, projectId, workspaceId, matchMode };
  const queryKey = tasksTableQueryKey({ q, sort, order, matchMode, projectId, workspaceId, organizationId });

  return infiniteQueryOptions({
    queryKey,
    initialPageParam,
    refetchOnWindowFocus: false,
    meta: { persist: false },
    queryFn: async ({ pageParam: { page, offset: _offset }, signal }) => {
      const offset = String(_offset || (page || 0) * Number(limit));
      return await getTasks({
        path: { organizationId, tenantId },
        query: { ...query, limit, offset },
        signal,
      });
    },
    staleTime: syncStaleTime,
    getNextPageParam: getTasksNextPageParam,
  });
};

// --- Mutations ---

export const useTaskCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const orgKey = taskKeys.list.org(organizationId);

  return useMutation({
    mutationKey: taskKeys.create,
    mutationFn: async (variables: TaskCreateMutationFnVariables) =>
      executeTaskCreate({ tenantId, organizationId }, variables),
    scope: { id: 'task' },
    onMutate: async ({ fullLabels, fullAssignedTo, isSheet, ...variables }: TaskCreateMutationFnVariables) => {
      const optimisticTask = createOptimisticEntity(zTask, {
        ...variables,
        tenantId,
        organizationId: organizationId,
        labels: fullLabels,
        assignedTo: fullAssignedTo,
      });
      const optimisticId = optimisticTask.id;
      const scopeKey = taskKeys.list.home(organizationId, variables.projectId);

      await queryClient.cancelQueries({ queryKey: orgKey });
      cacheCreate(scopeKey, [optimisticTask]);

      setTimeout(() => triggerTaskGlow(optimisticId));

      return { optimisticTask };
    },
    meta: { suppressGlobalErrorToast: true },
    onError: (_err, _vars, context) => {
      handleError('create');
      if (context?.optimisticTask) cacheRemove(orgKey, [context.optimisticTask]);
    },
    onSuccess: (createdTask, _variables, context) => {
      // Replace optimistic with real task in-place to preserve DOM element (and ongoing glow animation).
      // If optimistic is gone, an SSE delete raced our POST response.
      if (context?.optimisticTask && findTaskInCache(context.optimisticTask.id)) {
        cacheUpdate(orgKey, [createdTask]);
      }

      // Backend bumped usedCount, mark label list stale (SSE handles refresh).
      if (createdTask.labels.length > 0) {
        queryClient.invalidateQueries({ queryKey: labelQueryKeys.list.base, refetchType: 'none' });
      }
    },
    // Error-only: onSuccess patches cache, SSE handles other users
    onSettled: (_data, error) => {
      if (error) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, orgKey);
    },
  });
};

export const useTaskUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const orgKey = taskKeys.list.org(organizationId);

  return useMutation({
    mutationKey: taskKeys.update,
    mutationFn: async (variables: TaskUpdateMutationFnVariables) =>
      executeTaskUpdate({ tenantId, organizationId }, variables),
    onMutate: async (variables: TaskUpdateMutationFnVariables) => {
      const { id: taskId, ops } = variables;

      // If there's a pending create for this entity, fold update ops into it
      if (ops && squashIntoPendingCreate(queryClient, taskKeys.create, taskId, ops as Record<string, unknown>)) {
        return { coalesced: true };
      }

      const mergedOps = ops
        ? squashPendingMutation(queryClient, taskKeys.update, taskId, ops as Record<string, unknown>)
        : {};
      // Write merged ops back so the mutationFn sends the accumulated batch
      if (ops) variables.ops = mergedOps as typeof ops;

      await queryClient.cancelQueries({ queryKey: orgKey });

      const previousTask = findTaskInCache(taskId);

      if (previousTask) {
        // Build optimistic task from merged ops
        const optimisticUpdates: Partial<Task> = {};
        for (const [key, value] of Object.entries(mergedOps)) {
          if (key === 'labels' && variables.fullLabels) {
            optimisticUpdates.labels = variables.fullLabels;
          } else if (key === 'assignedTo' && variables.fullAssignedTo) {
            optimisticUpdates.assignedTo = variables.fullAssignedTo;
          } else if (!isArrayDelta(value)) {
            // Only apply scalar values directly, AWSet deltas use fullLabels/fullAssignedTo.
            (optimisticUpdates as Record<string, unknown>)[key] = value;
          }
        }

        // When description changes, derive all virtual props optimistically.
        // Counts are derived even without a client-computed summary (e.g. checkbox
        // toggles skip summary; the backend regenerates it server-side).
        if (typeof mergedOps.description === 'string') {
          Object.assign(optimisticUpdates, deriveDescriptionCounts(mergedOps.description));
          if (variables.summary) {
            optimisticUpdates.summary = variables.summary;
            optimisticUpdates.summaryLength = variables.summaryLength ?? previousTask.summaryLength;
          }
        }

        const optimisticTask: Task = {
          ...previousTask,
          ...optimisticUpdates,
          updatedAt: new Date().toISOString(),
        };

        // Cross-project move: remove from old project cache, add to new project cache
        if ('projectId' in mergedOps && mergedOps.projectId !== previousTask.projectId) {
          // Strip labels optimistically because they are project-scoped.
          optimisticTask.labels = [];
          const oldScopeKey = taskKeys.list.home(organizationId, previousTask.projectId);
          cacheRemove(oldScopeKey, [previousTask]);
          const newScopeKey = taskKeys.list.home(organizationId, mergedOps.projectId as string);
          cacheCreate(newScopeKey, [optimisticTask]);
          queryClient.setQueryData<Task>(taskKeys.detail.byId(taskId), optimisticTask);
        } else {
          cacheUpdate(orgKey, [optimisticTask]);
          queryClient.setQueryData<Task>(taskKeys.detail.byId(taskId), (old) => (old ? optimisticTask : old));
        }
      }

      setTimeout(() => triggerTaskGlow(taskId));

      return { previousTask };
    },
    meta: { suppressGlobalErrorToast: true },
    onError: (_err, _vars, context) => {
      // If the task was deleted while this update was in flight, suppress the error
      if (context?.previousTask && !findTaskInCache(context.previousTask.id)) return;

      handleError('update');
      if (context?.previousTask) {
        // Cross-project move rollback: remove from new project, restore to old
        if (_vars.ops && 'projectId' in _vars.ops && _vars.ops.projectId !== context.previousTask.projectId) {
          const newScopeKey = taskKeys.list.home(organizationId, _vars.ops.projectId as string);
          cacheRemove(newScopeKey, [context.previousTask]);
          const oldScopeKey = taskKeys.list.home(organizationId, context.previousTask.projectId);
          cacheCreate(oldScopeKey, [context.previousTask]);
        } else {
          cacheUpdate(orgKey, [context.previousTask]);
        }
        queryClient.setQueryData<Task>(taskKeys.detail.byId(context.previousTask.id), context.previousTask);
      }
    },
    onSuccess: (updatedTask, variables) => {
      const detailKey = taskKeys.detail.byId(updatedTask.id);
      const cached = findTaskInCache(updatedTask.id);
      const mutatedKeys = variables.ops ? Object.keys(variables.ops) : [];

      // When description changes, also merge server-computed derived fields
      if (variables.ops && 'description' in variables.ops) {
        mutatedKeys.push(...TASK_DERIVED_DESCRIPTION_FIELDS);
      }

      // When status changes, server stamps statusChangedAt
      if (variables.ops && 'status' in variables.ops) mutatedKeys.push('statusChangedAt');

      // Cross-project move: server response has authoritative labels/assignedTo
      const isProjectMove = variables.ops && 'projectId' in variables.ops;
      const merged = mergeServerResponse({
        cached,
        serverEntity: updatedTask,
        mutatedKeys,
        skipKeys: isProjectMove ? [] : ['labels', 'assignedTo'],
      });
      cacheUpdate(orgKey, [merged]);
      queryClient.setQueryData<Task>(detailKey, (old) => (old ? { ...old, ...merged } : old));

      // Backend managed label usedCount side-effects, mark label list stale (SSE handles refresh).
      if (variables.ops && ('labels' in variables.ops || 'projectId' in variables.ops)) {
        queryClient.invalidateQueries({ queryKey: labelQueryKeys.list.base, refetchType: 'none' });
      }
    },
    // Error-only: onSuccess patches cache, SSE handles other users
    onSettled: (_data, error) => {
      if (error) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, orgKey);
    },
  });
};

export const useTaskDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const orgKey = taskKeys.list.org(organizationId);

  return useMutation({
    mutationKey: taskKeys.delete,
    scope: { id: 'task' },
    mutationFn: async (variables: TasksDeleteMutationFnVariables) =>
      executeTasksDelete({ tenantId, organizationId }, variables),
    onMutate: async ({ tasksToDelete }: TasksDeleteMutationFnVariables) => {
      removePendingMutations(
        queryClient,
        taskKeys.update,
        tasksToDelete.map((t) => t.id),
      );
      await queryClient.cancelQueries({ queryKey: orgKey });
      cacheRemove(orgKey, tasksToDelete);
      for (const { id } of tasksToDelete) {
        queryClient.removeQueries({ queryKey: taskKeys.detail.byId(id) });
      }
      return { tasksToDelete };
    },
    meta: { suppressGlobalErrorToast: true },
    onError: (_err, _vars, context) => {
      handleError('delete');
      // Restore to org-level; items only land in queries where they match by ID bail-out.
      if (context?.tasksToDelete) cacheCreate(orgKey, context.tasksToDelete);
    },
    onSuccess: (_data, { tasksToDelete }) => {
      // Backend decremented label usedCount, mark label list stale (SSE handles refresh).
      if (tasksToDelete.some((t) => t.labels.length > 0)) {
        queryClient.invalidateQueries({ queryKey: labelQueryKeys.list.base, refetchType: 'none' });
      }
    },
    // Error-only: onMutate removed from all caches, SSE handles other users
    onSettled: (_data, error) => {
      if (error) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, orgKey);
    },
  });
};

// --- Mutation defaults (offline persistence) ---

addMutationRegistrar((qc: QueryClient) => {
  qc.setQueryDefaults(taskKeys.detail.base, {
    queryFn: ({ queryKey, meta }) => {
      const id = queryKey[2] as string;
      const cachedTask = findTaskInCache(id);
      const organizationId = (meta?.organizationId as string) ?? cachedTask?.organizationId ?? getRouteOrgId();
      const tenantId = (meta?.tenantId as string) ?? cachedTask?.tenantId ?? getRouteTenantId();
      if (!organizationId || !tenantId) throw new Error('Cannot resolve organizationId/tenantId for task fetch');
      return getTask({
        path: { id, organizationId, tenantId },
      });
    },
  });

  // Resumed mutations replay the hook-shaped persisted variables; org context is not
  // in the variables, so resolve it from cache (update/delete) or the current route.
  qc.setMutationDefaults(taskKeys.create, {
    mutationFn: async (variables: TaskCreateMutationFnVariables) => executeTaskCreate(resolveOrgContext(), variables),
  });

  qc.setMutationDefaults(taskKeys.update, {
    mutationFn: async (variables: TaskUpdateMutationFnVariables) =>
      executeTaskUpdate(resolveOrgContext(findTaskInCache(variables.id)), variables),
  });

  qc.setMutationDefaults(taskKeys.delete, {
    mutationFn: async (variables: TasksDeleteMutationFnVariables) =>
      executeTasksDelete(resolveOrgContext(variables.tasksToDelete[0]), variables),
  });
});

/** Fetch tasks for table export. Bypasses cache; returns flat items. */
export const fetchTasksForExport = async (params: {
  limit: number;
  offset?: number;
  organizationId: string;
  tenantId: string;
  query: Omit<NonNullable<GetTasksData['query']>, 'limit' | 'offset'>;
}) => {
  const { limit, offset = 0, organizationId, tenantId, query } = params;
  const { items } = await getTasks({
    query: { ...query, limit: String(limit), offset: String(offset) },
    path: { organizationId, tenantId },
  });
  return items;
};
