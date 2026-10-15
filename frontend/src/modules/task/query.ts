import type { QueryClient, UseMutationOptions } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import type { CreateTasksData, GetTasksData, UpdateTaskData, UserMinimalBase } from 'sdk';
import { createTasks, deleteTasks, getTask, getTasks, updateTask } from 'sdk';
import { zCreateTasksBody, zTask } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import { isRecord } from 'shared/utils/as-record';
import { deriveDocument } from 'shared/utils/derive-description-core';
import { registerDescriptionDerivation } from '~/modules/common/blocknote/description-derivation';
import { registerYjsOwnedFields } from '~/modules/common/blocknote/yjs-editor';
import { toaster } from '~/modules/common/toaster/toaster';
import { findLabelInCache } from '~/modules/label/query';
import { getProjectPublicAt } from '~/modules/project/query';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { boardAcceptedCutOff } from '~/modules/task/task-properties';
import type { Task, TaskLabel } from '~/modules/task/types';
import { insertEntitiesIntoHome } from '~/query/basic/apply-entity-to-lists';
import { cacheCreate, cacheRemove, cacheUpdate, removeDetailQueriesById } from '~/query/basic/cache-mutations';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys, SYNC_CHUNK_SIZE } from '~/query/basic/entity-query-registry';
import { fetchAllPages } from '~/query/basic/fetch-all-pages';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { offsetPaging, pageQuery } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation, removePendingMutations } from '~/query/basic/invalidation-helpers';
import { syncStaleTime } from '~/query/basic/sync-stale-state';
import { addMutationRegistrar } from '~/query/mutation-registry';
import { isArrayDelta } from '~/query/offline/array-delta';
import { type CreateVariables, type DeleteVariables, registerVariablesVersion, type UpdateVariables } from '~/query/offline/mutation-variables';
import { buildPreparedHandlers, type PreparedVars } from '~/query/offline/prepared-mutation';
import { removePausedCreates, squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
import { createStxForCreate, createStxForDelete, createStxForUpdate } from '~/query/offline/stx-utils';
import { mergeServerResponse } from '~/query/offline/update-success-utils';
import { resolveQueryOrgTenantIds } from '~/query/realtime/sync-priority';
import { createResourceError } from '~/utils/resource-error';

export type GetTasksParam = GetTasksData['path'] & Omit<NonNullable<GetTasksData['query']>, 'limit' | 'offset'>;
export type BaseTasksQueryParam = Pick<GetTasksParam, 'workspaceId' | 'projectId' | 'organizationId' | 'tenantId'>;

/** Derives task query parameters directly from entity objects. */
export const deriveTasksQueryParams = (
  workspace?: { id: string; organizationId: string; tenantId: string },
  project?: { id: string; organizationId: string; tenantId: string },
): BaseTasksQueryParam => {
  if (workspace) return { tenantId: workspace.tenantId, organizationId: workspace.organizationId, workspaceId: workspace.id };
  if (project) return { tenantId: project.tenantId, organizationId: project.organizationId, projectId: project.id };
  throw new Error('Either workspace or project is required to derive task query params');
};

type CreateTaskDataInner = Omit<CreateTasksData['body'][number], 'stx'>;
type UpdateTaskOps = UpdateTaskData['body']['ops'];
type BaseUpdateParams = Pick<UpdateTaskData['path'], 'id'> & { ops: UpdateTaskOps };

/** Client-only fields for building correct optimistic cache shape (not in API schema) */
type OptimisticCacheFields = {
  fullLabels: TaskLabel[];
  fullAssignedTo: UserMinimalBase[];
};

type TaskCreateMutationFnVariables = CreateTaskDataInner & OptimisticCacheFields;

export type TaskUpdateMutationFnVariables = BaseUpdateParams & Partial<OptimisticCacheFields>;

type TaskCreateFullVars = CreateVariables<TaskCreateMutationFnVariables>;
type TaskUpdateFullVars = UpdateVariables<UpdateTaskOps> & Partial<OptimisticCacheFields>;
type TasksDeleteFullVars = DeleteVariables<Task>;

/** Retains API literal unions for task-list sorting and matching filters. */
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
  detail: { ...baseKeys.detail, public: (id: string) => ['task', 'detail', 'public', id] as const },
  /** Public task list keys (separate from authenticated queries) */
  publicList: { base: ['task', 'public-list'] as const, filtered: (filters: PublicTaskListFilters) => ['task', 'public-list', filters] as const },
};

/** The keys a create row takes. An edit of any other field cannot fold into a queued create. */
const taskCreateKeys = Object.keys(zCreateTasksBody.element.shape);

registerEntityQueryKeys('task', taskKeys, (organizationId, tenantId, seqCursor, channelId) => {
  return getTasks({
    path: { tenantId: tenantId!, organizationId: organizationId! },
    query: { seqCursor, projectId: channelId, limit: String(SYNC_CHUNK_SIZE) },
  });
});

/**
 * The task columns `deriveDescriptionProps` (backend) stores from a description, minus `keywords`: the server
 * extracts those with its own word list, and they only feed server search.
 */
const deriveTaskDescription = (description: string | null) => {
  const { summary, summaryLength, counts } = deriveDocument(description);
  const { expandable, checkboxCount, checkedCount, attachments } = counts;
  return { summary, summaryLength, expandable, checkboxCount, checkedCount, attachments };
};

/** Every column the server derives from the description: merged from its response after a description write. */
const TASK_DERIVED_DESCRIPTION_FIELDS = [
  'summary',
  'summaryLength',
  'expandable',
  'checkboxCount',
  'checkedCount',
  'attachments',
  'keywords',
] as const;

registerDescriptionDerivation('task', deriveTaskDescription);
registerYjsOwnedFields('task', ['description', ...TASK_DERIVED_DESCRIPTION_FIELDS]);

const tasksMutationKeyBase = ['task'] as const;
const handleError = createResourceError('task');

const findTaskInCache = createCacheFinder<Task>('task');

// Shared mutation functions rebuild requests from durable variables for interactive and offline replay.
// Optimistic UI fields are removed before SDK operations.

const createTaskMutationFn = async ({ tenantId, organizationId, data, stx }: TaskCreateFullVars) => {
  const effectiveStx = stx ?? createStxForCreate();
  const body = data.map(({ fullLabels: _fl, fullAssignedTo: _fa, ...row }) => ({ ...row, stx: effectiveStx }));
  const result = await createTasks({ body, path: { organizationId, tenantId } });
  return result.data;
};

/** Sends one task update; exported for the replay test. */
export const updateTaskMutationFn = async ({ tenantId, organizationId, id, ops, stx }: TaskUpdateFullVars) => {
  // HLC timestamps only for scalar fields (AWSet fields are commutative).
  const scalarFieldNames = ops ? Object.keys(ops).filter((k) => !isArrayDelta(ops[k as keyof typeof ops])) : [];
  const effectiveStx = stx ?? createStxForUpdate(scalarFieldNames);
  return updateTask({ body: { ops, stx: effectiveStx }, path: { id, organizationId, tenantId } });
};

const deleteTasksMutationFn = async ({ tenantId, organizationId, rows, stx }: TasksDeleteFullVars) => {
  const ids = rows.map(({ id }) => id);
  const effectiveStx = stx ?? createStxForDelete();
  return deleteTasks({ body: { ids, stx: effectiveStx }, path: { organizationId, tenantId } });
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

    // primaryLabel is a server-hydrated object; rebuild it from the cached label row so
    // the card and table update before the response lands (onSuccess merges server truth).
    if (typeof mergedOps.primaryLabelId === 'string') {
      const freshPrimary = findLabelInCache(mergedOps.primaryLabelId);
      if (freshPrimary) optimisticUpdates.primaryLabel = freshPrimary;
    }

    if ('description' in mergedOps) Object.assign(optimisticUpdates, deriveTaskDescription(mergedOps.description as string | null));

    const optimisticTask: Task = { ...previousTask, ...optimisticUpdates, updatedAt: new Date().toISOString() };

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

export const taskQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: taskKeys.detail.byId(id),
    queryFn: () => getTask({ path: { id, organizationId, tenantId } }),
    initialData: () => findTaskInCache(id),
  });

/**
 * Canonical task query: one flat query per project scope.
 * Fetches all tasks for a project, stored at taskKeys.list.home(organizationId, projectId).
 * Board/table derive views via select() or client-side filtering.
 * Sync (SSE + delta fetch) keeps this fresh; staleTime follows sync liveness.
 */
export const tasksCanonicalOptions = ({ organizationId, tenantId, projectId }: { organizationId: string; tenantId: string; projectId: string }) => {
  return queryOptions({
    queryKey: taskKeys.list.home(organizationId, projectId),
    queryFn: () => {
      return fetchAllPages(
        ({ limit, offset }) =>
          getTasks({ path: { organizationId, tenantId }, query: { projectId, limit, offset, acceptedCutOff: boardAcceptedCutOff } }),
        appConfig.requestLimits.tasks,
      );
    },
    staleTime: syncStaleTime,
  });
};

/** Task-table defaults shared by the member and public query options. */
export const tasksTableQueryDefaults = { sort: 'createdAt', order: 'desc', matchMode: 'all' } as const;

const tasksTableQueryKey = ({
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
  limit = appConfig.requestLimits.tasksTable,
}: Omit<GetTasksParam, 'acceptedCutOff'> & { limit?: number }) => {
  const filters = { q, sort, order, organizationId, projectId, workspaceId, matchMode };

  return infiniteQueryOptions({
    queryKey: tasksTableQueryKey({ q, sort, order, matchMode, projectId, workspaceId, organizationId }),
    ...offsetPaging(limit, (offset, signal) =>
      getTasks({ path: { organizationId, tenantId }, query: { ...filters, ...pageQuery(limit, offset) }, signal }),
    ),
    refetchOnWindowFocus: false,
    meta: { persist: false },
    staleTime: syncStaleTime,
  });
};

/**
 * Full options for one task op, shared by the live hook and the offline-replay defaults so a
 * replay reconciles like the live one. Callbacks take the QueryClient explicitly and derive the org
 * key from durable variables. On replay onMutate does not re-run, so onSettled invalidation recovers.
 */
const taskCreateOptions = (queryClient: QueryClient): UseMutationOptions<CreateData, Error, TaskCreateFullVars, { optimisticTasks: Task[] }> => ({
  mutationKey: taskKeys.create,
  scope: { id: 'task' },
  mutationFn: createTaskMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ tenantId, organizationId, data }) => {
    const orgKey = taskKeys.list.org(organizationId);
    const optimisticTasks = data.map(({ fullLabels, fullAssignedTo, ...row }) =>
      createOptimisticEntity(zTask, {
        ...row,
        ...deriveTaskDescription(row.description ?? null),
        tenantId,
        organizationId,
        labels: fullLabels,
        assignedTo: fullAssignedTo,
      }),
    );
    await queryClient.cancelQueries({ queryKey: orgKey });
    // Insert into the row's canonical home (project) list only, never filtered/search lists.
    insertEntitiesIntoHome(queryClient, optimisticTasks);

    setTimeout(() => {
      for (const { id } of optimisticTasks) triggerTaskGlow(id);
    });

    return { optimisticTasks };
  },
  onError: (error, variables, context) => {
    handleError('create', error);
    if (context?.optimisticTasks) cacheRemove(taskKeys.list.org(variables.organizationId), context.optimisticTasks);
  },
  onSuccess: (createdTasks, variables) => {
    // Replace optimistic with real task in-place to preserve DOM element (and ongoing glow animation).
    // An update inserts nothing, so a row an SSE delete removed while the POST was out stays gone.
    cacheUpdate(taskKeys.list.org(variables.organizationId), createdTasks);
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
  onError: (error, variables, context) => {
    // If the task was deleted while this update was in flight, suppress the error
    if (context?.previousTask && !findTaskInCache(context.previousTask.id)) return;

    handleError('update', error);
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

    // Cross-project move: server response has authoritative labels/assignedTo
    const isProjectMove = variables.ops && 'projectId' in variables.ops;
    const merged = mergeServerResponse({
      cached,
      serverEntity: updatedTask,
      mutatedKeys,
      derivedKeys: { description: TASK_DERIVED_DESCRIPTION_FIELDS, status: ['statusChangedAt'] },
      skipKeys: isProjectMove ? [] : ['labels', 'assignedTo'],
    });

    // The lite response path answers primaryLabel: null, so a merged response must never
    // supply it; rebuild the derived object from the cached label row the id points at.
    if (!isProjectMove && typeof variables.ops?.primaryLabelId === 'string') {
      const freshPrimary = findLabelInCache(variables.ops.primaryLabelId);
      if (freshPrimary) merged.primaryLabel = freshPrimary;
    }
    cacheUpdate(orgKey, [merged]);
    queryClient.setQueryData<Task>(detailKey, (old) => (old ? { ...old, ...merged } : old));
  },
  // Error-only: onSuccess patches cache, SSE handles other users
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, taskKeys.list.org(variables.organizationId));
  },
});

const taskDeleteOptions = (queryClient: QueryClient): UseMutationOptions<DeleteData, Error, TasksDeleteFullVars, { tasksToDelete: Task[] }> => ({
  mutationKey: taskKeys.delete,
  scope: { id: 'task' },
  mutationFn: deleteTasksMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ organizationId, rows }) => {
    const orgKey = taskKeys.list.org(organizationId);
    const taskIds = rows.map(({ id }) => id);
    removePendingMutations(queryClient, taskKeys.update, taskIds);
    await queryClient.cancelQueries({ queryKey: orgKey });
    cacheRemove(orgKey, rows);
    removeDetailQueriesById(queryClient, taskKeys.detail.base, taskIds);
    return { tasksToDelete: rows };
  },
  onError: (error, _variables, context) => {
    handleError('delete', error);
    if (context?.tasksToDelete) insertEntitiesIntoHome(queryClient, context.tasksToDelete);
  },
  onSuccess: (result, variables) => {
    const rejectedIds = result?.rejectedIds ?? [];
    if (rejectedIds.length === 0) return;
    const rejectedSet = new Set(rejectedIds);
    const rejectedTasks = variables.rows.filter((row) => rejectedSet.has(row.id));
    insertEntitiesIntoHome(queryClient, rejectedTasks);
    toaster.info(i18n.t('c:resources_delete_denied', { count: rejectedIds.length, total: variables.rows.length }));
  },
  onSettled: (data, error, variables) => {
    // A row put back is as the delete held it: remote changes were kept from the cache while it was pending.
    if (error || data?.rejectedIds?.length) invalidateIfLastMutation(queryClient, tasksMutationKeyBase, taskKeys.list.org(variables.organizationId));
  },
});

/** Provides the React Query mutation for task create. */
export const useTaskCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(taskCreateOptions(queryClient));

  // Inject org context + stx so a replay reuses the original mutation id and timestamps; callers pass the task data.
  // Stamp publicAt from the parent project so a new task inherits its project's publicity at create time.
  const prepare = (input: TaskCreateMutationFnVariables): PreparedVars<TaskCreateFullVars> => ({
    kind: 'run',
    vars: { tenantId, organizationId, data: [{ ...input, publicAt: getProjectPublicAt(input.projectId, tenantId) }], stx: createStxForCreate() },
  });

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

/** Provides the React Query mutation for task update. */
export const useTaskUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(taskUpdateOptions(queryClient));

  /** Folding into a queued create issues no update and patches the optimistic row here (onMutate won't run). */
  const prepare = (input: TaskUpdateMutationFnVariables): PreparedVars<TaskUpdateFullVars> => {
    const { id: taskId, ops } = input;

    if (ops && squashIntoPendingCreate(queryClient, taskKeys.create, taskId, ops as Record<string, unknown>, taskCreateKeys)) {
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

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

/** Provides the React Query mutation for task delete. */
export const useTaskDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(taskDeleteOptions(queryClient));

  /** Tasks deleted while offline never reached the server: cancel their queued work and keep them out of the request. */
  const prepare = (tasks: Task[]): PreparedVars<TasksDeleteFullVars> => {
    const taskIds = tasks.map(({ id }) => id);
    const cancelled = new Set(removePausedCreates(queryClient, taskKeys.create, taskIds));

    if (cancelled.size > 0) {
      const localOnly = tasks.filter((t) => cancelled.has(t.id));
      const localOnlyIds = localOnly.map(({ id }) => id);
      removePendingMutations(queryClient, taskKeys.update, localOnlyIds);
      cacheRemove(taskKeys.list.org(organizationId), localOnly);
      removeDetailQueriesById(queryClient, taskKeys.detail.base, localOnlyIds);
    }

    const remaining = tasks.filter((t) => !cancelled.has(t.id));
    if (remaining.length === 0) return { kind: 'noop' };
    return { kind: 'run', vars: { tenantId, organizationId, rows: remaining, stx: createStxForDelete() } };
  };

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

// Mutation defaults (offline persistence)

addMutationRegistrar((queryClient: QueryClient) => {
  queryClient.setQueryDefaults(taskKeys.detail.base, {
    queryFn: ({ queryKey, meta }) => {
      const id = queryKey[2] as string;
      const cached = findTaskInCache(id);
      const { organizationId, tenantId } = resolveQueryOrgTenantIds(meta, cached, 'task');
      return getTask({ path: { id, organizationId, tenantId } });
    },
  });

  queryClient.setMutationDefaults(taskKeys.create, taskCreateOptions(queryClient));
  queryClient.setMutationDefaults(taskKeys.update, taskUpdateOptions(queryClient));
  queryClient.setMutationDefaults(taskKeys.delete, taskDeleteOptions(queryClient));
});

// Version 2 carries a create's rows as a list under `data` and a delete's under `rows`; version 1 queued a create's one row
// at the top level and a delete's rows as `tasksToDelete`.
registerVariablesVersion(taskKeys.create, 2, (variables) => {
  if (!isRecord(variables) || typeof variables.id !== 'string') return null;
  const { tenantId, organizationId, stx, ...row } = variables;
  return { tenantId, organizationId, stx, data: [row] };
});
registerVariablesVersion(taskKeys.delete, 2, (variables) => {
  if (!isRecord(variables) || !Array.isArray(variables.tasksToDelete)) return null;
  const { tasksToDelete, ...rest } = variables;
  return { ...rest, rows: tasksToDelete };
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
  const { items } = await getTasks({ query: { ...query, limit: String(limit), offset: String(offset) }, path: { organizationId, tenantId } });
  return items;
};
