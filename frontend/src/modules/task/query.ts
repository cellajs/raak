import type { GetNextPageParamFunction, QueryClient, UseMutationOptions } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions, useQueryClient } from '@tanstack/react-query';
import type { CreateTasksData, GetTasksData, StxBase, UpdateTaskData, UserMinimalBase } from 'sdk';
import { createTasks, deleteTasks, getTask, getTasks, updateTask } from 'sdk';
import { zTask } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import { registerYjsOwnedFields } from '~/modules/common/blocknote/yjs-editor';
import { labelQueryKeys } from '~/modules/label/query';
import { deriveDescriptionCounts } from '~/modules/task/helpers/derive-description-props';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { boardAcceptedCutOff } from '~/modules/task/task-properties';
import type { Task, TaskLabel } from '~/modules/task/types';
import { insertEntitiesIntoHome } from '~/query/basic/apply-entity-to-lists';
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
import { type PreparedVars, usePreparedMutation } from '~/query/offline/prepared-mutation';
import { removePausedCreates, squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
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

// Durable mutation variables: carry tenant/org context AND stx so a mutation replayed from the
// persisted queue after a reload (component closure gone) reconstructs the same request. stx is
// minted at intent time so a replay reuses the original mutationId and field timestamps (LWW must
// arbitrate by intent time). The `?? createStxFor*` fallback in each fn keeps old queues replayable.
type TaskCreateFullVars = QueryOrgContext & TaskCreateMutationFnVariables & { stx?: StxBase };
type TaskUpdateFullVars = QueryOrgContext & TaskUpdateMutationFnVariables & { stx?: StxBase };
type TasksDeleteFullVars = QueryOrgContext & TasksDeleteMutationFnVariables & { stx?: StxBase };

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

registerEntityQueryKeys('task', taskKeys, (organizationId, tenantId, seqCursor, scopeChannelId) => {
  return getTasks({
    path: { tenantId: tenantId!, organizationId: organizationId! },
    query: { seqCursor, projectId: scopeChannelId, limit: String(SYNC_CHUNK_SIZE) },
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

// --- Mutation fns ---
// Shared by the interactive hooks and the offline-replay defaults, so a mutation resumed from
// persistence reconstructs the same request from durable variables alone. The optimistic-only
// fields (fullLabels/fullAssignedTo/isSheet/summary/summaryLength) are stripped before the request.

const createTaskMutationFn = async (vars: TaskCreateFullVars) => {
  const {
    tenantId,
    organizationId,
    stx,
    fullLabels: _fl,
    fullAssignedTo: _fa,
    isSheet: _is,
    summary: _summary,
    ...data
  } = vars;
  const effectiveStx = stx ?? createStxForCreate();
  const result = await createTasks({ body: [{ ...data, stx: effectiveStx }], path: { organizationId, tenantId } });
  return result.data[0];
};

const updateTaskMutationFn = async ({ tenantId, organizationId, id, ops, stx }: TaskUpdateFullVars) => {
  // HLC timestamps only for scalar fields (AWSet fields are commutative).
  const scalarFieldNames = ops ? Object.keys(ops).filter((k) => !isArrayDelta(ops[k as keyof typeof ops])) : [];
  const effectiveStx = stx ?? createStxForUpdate(scalarFieldNames);
  return updateTask({ body: { ops, stx: effectiveStx }, path: { id, organizationId, tenantId } });
};

const deleteTasksMutationFn = async ({ tenantId, organizationId, tasksToDelete, stx }: TasksDeleteFullVars) => {
  const ids = tasksToDelete.map(({ id }) => id);
  const effectiveStx = stx ?? createStxForDelete();
  const response = await deleteTasks({ body: { ids, stx: effectiveStx }, path: { organizationId, tenantId } });
  return response.rejectedIds.length === 0;
};

type CreateData = Awaited<ReturnType<typeof createTaskMutationFn>>;
type UpdateData = Awaited<ReturnType<typeof updateTaskMutationFn>>;
type DeleteData = Awaited<ReturnType<typeof deleteTasksMutationFn>>;

/**
 * Apply an update's optimistic cache patch: scalar ops land directly, AWSet fields use the
 * pre-resolved fullLabels/fullAssignedTo, a description change derives its virtual props, and a
 * cross-project move relocates the row between project home lists. Shared by the update onMutate and
 * the prepare step's coalesced branch (folding into a queued create, where onMutate does not run).
 */
const applyOptimisticTaskUpdate = (
  queryClient: QueryClient,
  organizationId: string,
  variables: TaskUpdateFullVars,
): { previousTask: Task | undefined } => {
  const { id: taskId, ops } = variables;
  const orgKey = taskKeys.list.org(organizationId);
  const mergedOps = (ops ?? {}) as Record<string, unknown>;
  const previousTask = findTaskInCache(taskId);

  if (previousTask) {
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

// --- Mutation options ---
// Full options (not just mutationFn) shared by the live hooks and the offline-replay defaults, so a
// replayed mutation runs the same reconciliation callbacks. Callbacks derive the org key from
// durable variables; on replay onMutate does not re-run, so onSettled invalidation recovers.

const taskCreateOptions = (
  queryClient: QueryClient,
): UseMutationOptions<CreateData, Error, TaskCreateFullVars, { optimisticTask: Task }> => ({
  mutationKey: taskKeys.create,
  scope: { id: 'task' },
  mutationFn: createTaskMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ fullLabels, fullAssignedTo, isSheet: _isSheet, stx: _stx, tenantId, organizationId, ...rest }) => {
    const orgKey = taskKeys.list.org(organizationId);
    const optimisticTask = createOptimisticEntity(zTask, {
      ...rest,
      tenantId,
      organizationId,
      labels: fullLabels,
      assignedTo: fullAssignedTo,
    });
    await queryClient.cancelQueries({ queryKey: orgKey });
    // Insert into the row's canonical home (project) list only, never filtered/search lists.
    insertEntitiesIntoHome(queryClient, {
      entityType: 'task',
      entities: [optimisticTask],
      keys: taskKeys,
      organizationId,
    });

    setTimeout(() => triggerTaskGlow(optimisticTask.id));

    return { optimisticTask };
  },
  onError: (_err, variables, context) => {
    handleError('create');
    if (context?.optimisticTask) cacheRemove(taskKeys.list.org(variables.organizationId), [context.optimisticTask]);
  },
  onSuccess: (createdTask, variables, context) => {
    const orgKey = taskKeys.list.org(variables.organizationId);
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
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, taskKeys.list.org(variables.organizationId));
  },
});

const taskUpdateOptions = (
  queryClient: QueryClient,
): UseMutationOptions<UpdateData, Error, TaskUpdateFullVars, { previousTask: Task | undefined }> => ({
  mutationKey: taskKeys.update,
  // Same scope as create/delete: task writes serialize, so a squashed update never replays before its queued create.
  scope: { id: 'task' },
  mutationFn: updateTaskMutationFn,
  meta: { suppressGlobalErrorToast: true },
  // Squash/coalesce runs in the hook's prepare step, so variables already carry the merge; onMutate keeps only cache work.
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey: taskKeys.list.org(variables.organizationId) });
    return applyOptimisticTaskUpdate(queryClient, variables.organizationId, variables);
  },
  onError: (_err, variables, context) => {
    // If the task was deleted while this update was in flight, suppress the error
    if (context?.previousTask && !findTaskInCache(context.previousTask.id)) return;

    handleError('update');
    if (context?.previousTask) {
      const orgKey = taskKeys.list.org(variables.organizationId);
      // Cross-project move rollback: remove from new project, restore to old
      if (variables.ops && 'projectId' in variables.ops && variables.ops.projectId !== context.previousTask.projectId) {
        const newScopeKey = taskKeys.list.home(variables.organizationId, variables.ops.projectId as string);
        cacheRemove(newScopeKey, [context.previousTask]);
        const oldScopeKey = taskKeys.list.home(variables.organizationId, context.previousTask.projectId);
        cacheCreate(oldScopeKey, [context.previousTask]);
      } else {
        cacheUpdate(orgKey, [context.previousTask]);
      }
      queryClient.setQueryData<Task>(taskKeys.detail.byId(context.previousTask.id), context.previousTask);
    }
  },
  onSuccess: (updatedTask, variables) => {
    const orgKey = taskKeys.list.org(variables.organizationId);
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
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, taskKeys.list.org(variables.organizationId));
  },
});

const taskDeleteOptions = (
  queryClient: QueryClient,
): UseMutationOptions<DeleteData, Error, TasksDeleteFullVars, { tasksToDelete: Task[] }> => ({
  mutationKey: taskKeys.delete,
  scope: { id: 'task' },
  mutationFn: deleteTasksMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ organizationId, tasksToDelete }) => {
    const orgKey = taskKeys.list.org(organizationId);
    removePendingMutations(
      queryClient,
      taskKeys.update,
      tasksToDelete.map((t) => t.id),
    );
    await queryClient.cancelQueries({ queryKey: orgKey });
    cacheRemove(orgKey, tasksToDelete);
    for (const { id } of tasksToDelete) queryClient.removeQueries({ queryKey: taskKeys.detail.byId(id) });
    return { tasksToDelete };
  },
  onError: (_err, variables, context) => {
    handleError('delete');
    // Restore each row into its canonical home list only (updates in place elsewhere), never filtered lists.
    if (context?.tasksToDelete)
      insertEntitiesIntoHome(queryClient, {
        entityType: 'task',
        entities: context.tasksToDelete,
        keys: taskKeys,
        organizationId: variables.organizationId,
      });
  },
  onSuccess: (_data, { tasksToDelete }) => {
    // Backend decremented label usedCount, mark label list stale (SSE handles refresh).
    if (tasksToDelete.some((t) => t.labels.length > 0)) {
      queryClient.invalidateQueries({ queryKey: labelQueryKeys.list.base, refetchType: 'none' });
    }
  },
  // Error-only: onMutate removed from all caches, SSE handles other users
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, taskKeys.list.org(variables.organizationId));
  },
});

// --- Mutations ---

export const useTaskCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  // Inject org context + stx so a replay reuses the original mutation id and timestamps; callers pass the task data.
  return usePreparedMutation<
    CreateData,
    Error,
    TaskCreateFullVars,
    { optimisticTask: Task },
    TaskCreateMutationFnVariables
  >(taskCreateOptions(queryClient), (input) => ({
    kind: 'run',
    vars: { tenantId, organizationId, ...input, stx: createStxForCreate() },
  }));
};

export const useTaskUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();

  /**
   * Squash/coalesce before the mutation exists so the request carries the merge. Folding into a
   * queued create issues no update and patches the optimistic row here (onMutate won't run).
   */
  const prepare = (input: TaskUpdateMutationFnVariables): PreparedVars<TaskUpdateFullVars> => {
    const { id: taskId, ops } = input;

    if (ops && squashIntoPendingCreate(queryClient, taskKeys.create, taskId, ops as Record<string, unknown>)) {
      applyOptimisticTaskUpdate(queryClient, organizationId, { tenantId, organizationId, ...input });
      return { kind: 'coalesced' };
    }

    // Coalesce queued offline edits; squashPendingMutation keeps each inherited field's original
    // timestamp so LWW arbitrates by intent time, and only the changed fields carry this edit's stamps.
    const scalarFieldNames = ops ? Object.keys(ops).filter((k) => !isArrayDelta(ops[k as keyof typeof ops])) : [];
    const newStx = createStxForUpdate(scalarFieldNames);
    const { ops: mergedOps, stx } = ops
      ? squashPendingMutation(queryClient, taskKeys.update, taskId, ops as Record<string, unknown>, newStx)
      : { ops: {} as Record<string, unknown>, stx: newStx };

    return { kind: 'run', vars: { tenantId, organizationId, ...input, ops: mergedOps as typeof ops, stx } };
  };

  return usePreparedMutation<
    UpdateData,
    Error,
    TaskUpdateFullVars,
    { previousTask: Task | undefined },
    TaskUpdateMutationFnVariables
  >(taskUpdateOptions(queryClient), prepare);
};

export const useTaskDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();

  /**
   * Cancel queued creates for tasks deleted while offline (they never reached the server), clear
   * their queued updates, finish deletion cache-side, and keep them out of the request. `noop` when
   * nothing remains.
   */
  const prepare = ({ tasksToDelete }: TasksDeleteMutationFnVariables): PreparedVars<TasksDeleteFullVars> => {
    const cancelled = new Set(
      removePausedCreates(
        queryClient,
        taskKeys.create,
        tasksToDelete.map((t) => t.id),
      ),
    );
    const localOnly = tasksToDelete.filter((t) => cancelled.has(t.id));
    if (localOnly.length > 0) {
      removePendingMutations(
        queryClient,
        taskKeys.update,
        localOnly.map((t) => t.id),
      );
      cacheRemove(taskKeys.list.org(organizationId), localOnly);
      for (const { id } of localOnly) queryClient.removeQueries({ queryKey: taskKeys.detail.byId(id) });
    }
    const remaining = tasksToDelete.filter((t) => !cancelled.has(t.id));
    if (remaining.length === 0) return { kind: 'noop' };
    return { kind: 'run', vars: { tenantId, organizationId, tasksToDelete: remaining, stx: createStxForDelete() } };
  };

  return usePreparedMutation<
    DeleteData,
    Error,
    TasksDeleteFullVars,
    { tasksToDelete: Task[] },
    TasksDeleteMutationFnVariables
  >(taskDeleteOptions(queryClient), prepare);
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

  // The SAME full options the hooks use (not just mutationFn), so a replayed mutation runs the same reconciliation callbacks.
  qc.setMutationDefaults(taskKeys.create, taskCreateOptions(qc));
  qc.setMutationDefaults(taskKeys.update, taskUpdateOptions(qc));
  qc.setMutationDefaults(taskKeys.delete, taskDeleteOptions(qc));
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
