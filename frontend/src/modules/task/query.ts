import type { DefaultError, Mutation, QueryClient, UseMutationOptions } from '@tanstack/react-query';
import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import type { CreateTasksData, GetTasksData, UpdateTaskData, UserMinimalBase } from 'sdk';
import { createTasks, deleteTasks, getTask, getTasks, getUnseenTaskIds, updateTask } from 'sdk';
import { zCreateTasksBody, zTask } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import { isRecord } from 'shared/utils/as-record';
import { deriveDocument } from 'shared/utils/derive-description-core';
import { registerDescriptionDerivation } from '~/modules/common/blocknote/description-derivation';
import { registerYjsOwnedFields } from '~/modules/common/blocknote/yjs-owned-fields';
import { toaster } from '~/modules/common/toaster/toaster';
import { findLabelInCache } from '~/modules/label/query';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { boardAcceptedCutOffDays } from '~/modules/task/task-properties';
import type { Task, TaskLabel } from '~/modules/task/types';
import { insertEntitiesIntoHome } from '~/query/basic/apply-entity-to-lists';
import { cacheCreate, cacheRemove, cacheUpdate, removeDetailQueriesById } from '~/query/basic/cache-mutations';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys } from '~/query/basic/entity-query-registry';
import { fetchAllPages } from '~/query/basic/fetch-all-pages';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { liveItems, offsetPaging, pageQuery } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation, removePendingMutations } from '~/query/basic/invalidation-helpers';
import { syncStaleTime } from '~/query/basic/sync-stale-state';
import { addMutationRegistrar } from '~/query/mutation-registry';
import { isArrayDelta } from '~/query/offline/array-delta';
import {
  type CreateVariables,
  type DeleteVariables,
  entityIdsOf,
  registerVariablesVersion,
  type UpdateVariables,
} from '~/query/offline/mutation-variables';
import { prepareProductDelete } from '~/query/offline/prepare-delete';
import { buildPreparedHandlers, type PreparedVars } from '~/query/offline/prepared-mutation';
import { squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
import { createStxForCreate, createStxForDelete, createStxForUpdate } from '~/query/offline/stx-utils';
import { mergeServerResponse, writeEntityToCache } from '~/query/offline/update-success-utils';
import { resolveQueryOrgTenantIds } from '~/query/realtime/sync-priority';
import type { QueryData } from '~/query/types';
import { createResourceError } from '~/utils/resource-error';

export type GetTasksParam = GetTasksData['path'] & Omit<NonNullable<GetTasksData['query']>, 'limit' | 'offset' | 'afterSeq' | 'untilSeq'>;
export type BaseTasksQueryParam = Pick<GetTasksParam, 'workspaceId' | 'projectId' | 'organizationId' | 'tenantId'>;

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

/** Client-only fields for the optimistic cache shape, not in the API schema. */
type OptimisticCacheFields = {
  fullLabels: TaskLabel[];
  fullAssignedTo: UserMinimalBase[];
};

type TaskCreateMutationFnVariables = CreateTaskDataInner & OptimisticCacheFields;

type TaskUpdateMutationFnVariables = BaseUpdateParams & Partial<OptimisticCacheFields>;

type TaskCreateFullVars = CreateVariables<TaskCreateMutationFnVariables>;
type TaskUpdateFullVars = UpdateVariables<UpdateTaskOps> & Partial<OptimisticCacheFields>;
type TaskDeleteFullVars = DeleteVariables<Task>;

/** Retains API literal unions for task-list sorting and matching filters. */
type TaskListFilters = Pick<GetTasksParam, 'projectId' | 'workspaceId' | 'q' | 'sort' | 'order' | 'matchMode'>;
/** Separate key space for public (unauthenticated) task queries. */
type PublicTaskListFilters = TaskListFilters & { public: true };

const baseKeys = createEntityKeys<TaskListFilters>('task');

export const taskKeys = {
  ...baseKeys,
  list: {
    ...baseKeys.list,
    /** Org-scoped, so a prefix match on `list.org` reaches it. */
    filtered: (organizationId: string, filters: TaskListFilters) => ['task', 'list', organizationId, filters] as const,
  },
  detail: { ...baseKeys.detail, public: (id: string) => ['task', 'detail', 'public', id] as const },
  publicList: { base: ['task', 'public-list'] as const, filtered: (filters: PublicTaskListFilters) => ['task', 'public-list', filters] as const },
};

/** Every board visit takes its own snapshot, so nothing is kept for the next. */
export const unseenTaskIdsQueryOptions = (organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: ['task', 'unseen', organizationId],
    queryFn: () => getUnseenTaskIds({ path: { tenantId, organizationId } }),
    staleTime: 0,
    gcTime: 0,
  });

/** The keys a create row takes. An edit of any other field cannot fold into a queued create. */
const taskCreateKeys = Object.keys(zCreateTasksBody.element.shape);

registerEntityQueryKeys('task', taskKeys, ({ organizationId, tenantId, channelId, query }) => {
  return getTasks({ path: { tenantId: tenantId!, organizationId: organizationId! }, query: { ...query, projectId: channelId } });
});

/** The columns the backend stores from a description, minus `keywords`: the server extracts those with its own word list for server search. */
const deriveTaskDescription = (description: string | null) => {
  const { summary, summaryLength, counts } = deriveDocument(description);
  const { expandable, checkboxCount, checkedCount, attachments } = counts;
  return { summary, summaryLength, expandable, checkboxCount, checkedCount, attachments };
};

/** Every column the server derives from the description: merged from its response after a description write. */
const taskDerivedDescriptionFields = ['summary', 'summaryLength', 'expandable', 'checkboxCount', 'checkedCount', 'attachments', 'keywords'] as const;

registerDescriptionDerivation('task', deriveTaskDescription);
registerYjsOwnedFields('task', ['description', ...taskDerivedDescriptionFields]);

const handleError = createResourceError('task');

/** Refetches the organization's lists once no other task mutation is pending. */
const invalidateOrgLists = (queryClient: QueryClient, organizationId: string) =>
  invalidateIfLastMutation(queryClient, taskKeys.all, taskKeys.list.org(organizationId));

const findTaskInCache = createCacheFinder<Task>('task');

const createTaskMutationFn = async ({ tenantId, organizationId, data, stx }: TaskCreateFullVars) => {
  const effectiveStx = stx ?? createStxForCreate();
  const body = data.map(({ fullLabels: _fl, fullAssignedTo: _fa, ...row }) => ({ ...row, stx: effectiveStx }));
  const result = await createTasks({ body, path: { organizationId, tenantId } });
  return result.data;
};

/** HLC timestamps cover scalar fields only: AWSet fields are commutative. */
const scalarFieldNamesOf = (ops: UpdateTaskOps | undefined) =>
  Object.entries(ops ?? {})
    .filter(([, value]) => !isArrayDelta(value))
    .map(([key]) => key);

/** Exported for the replay test. */
export const updateTaskMutationFn = async ({ tenantId, organizationId, id, ops, stx }: TaskUpdateFullVars) => {
  const effectiveStx = stx ?? createStxForUpdate(scalarFieldNamesOf(ops));
  return updateTask({ body: { ops, stx: effectiveStx }, path: { id, organizationId, tenantId } });
};

const deleteTasksMutationFn = async ({ tenantId, organizationId, rows, stx }: TaskDeleteFullVars) => {
  const ids = rows.map(({ id }) => id);
  const effectiveStx = stx ?? createStxForDelete();
  return deleteTasks({ body: { ids, stx: effectiveStx }, path: { organizationId, tenantId } });
};

type CreateData = Awaited<ReturnType<typeof createTaskMutationFn>>;
type UpdateData = Awaited<ReturnType<typeof updateTaskMutationFn>>;
type DeleteData = Awaited<ReturnType<typeof deleteTasksMutationFn>>;

/** Shared by the update onMutate and the prepare step's coalesced branch (folding into a queued create, where onMutate does not run). */
const applyOptimisticTaskUpdate = (
  queryClient: QueryClient,
  organizationId: string,
  variables: TaskUpdateFullVars,
): { previousTask: Task | undefined } => {
  const { id: taskId, ops } = variables;
  const orgKey = taskKeys.list.org(organizationId);
  const mergedOps: Record<string, unknown> = ops ?? {};
  const previousTask = findTaskInCache(taskId);

  if (previousTask) {
    const optimisticUpdates: Partial<Task> = {};
    for (const [key, value] of Object.entries(mergedOps)) {
      if (key === 'labels' && variables.fullLabels) {
        optimisticUpdates.labels = variables.fullLabels;
      } else if (key === 'assignedTo' && variables.fullAssignedTo) {
        optimisticUpdates.assignedTo = variables.fullAssignedTo;
      } else if (!isArrayDelta(value)) {
        (optimisticUpdates as Record<string, unknown>)[key] = value;
      }
    }

    // primaryLabel is a server-hydrated object: rebuilt from the cached label row so views update before the response.
    if (typeof mergedOps.primaryLabelId === 'string') {
      const freshPrimary = findLabelInCache(mergedOps.primaryLabelId);
      if (freshPrimary) optimisticUpdates.primaryLabel = freshPrimary;
    }

    if ('description' in mergedOps) Object.assign(optimisticUpdates, deriveTaskDescription(mergedOps.description as string | null));

    const optimisticTask: Task = { ...previousTask, ...optimisticUpdates, updatedAt: new Date().toISOString() };

    if ('projectId' in mergedOps && mergedOps.projectId !== previousTask.projectId) {
      // Labels are project-scoped.
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

type TaskCreateMutation = Mutation<CreateData, DefaultError, TaskCreateFullVars, { optimisticTasks: Task[] }>;

/**
 * Starts one project list read and returns what completes it. The server's snapshot may predate creates still unanswered when the
 * read started, so their rows the read lacks are carried over: the optimistic row while out, the stored row once answered.
 */
const carryUnansweredCreates = (client: QueryClient, projectId: string) => {
  const startedAt = Date.now();
  // The mutation cache is untyped; this key only holds task creates.
  const creates = () => client.getMutationCache().findAll({ mutationKey: taskKeys.create }) as TaskCreateMutation[];
  const unanswered = new Set(creates().filter(({ state }) => state.status === 'pending'));

  return (read: QueryData<Task>): QueryData<Task> => {
    const present = new Set(read.items.map(({ id }) => id));
    const deleted = new Set(
      client
        .getMutationCache()
        .findAll({ mutationKey: taskKeys.delete })
        .filter(({ state }) => state.status !== 'error')
        .flatMap(({ state }) => entityIdsOf(state.variables)),
    );
    const carried = creates()
      .filter((mutation) => unanswered.has(mutation) || mutation.state.submittedAt >= startedAt)
      .flatMap(({ state }) =>
        state.status === 'success' ? (state.data ?? []) : state.status === 'pending' ? (state.context?.optimisticTasks ?? []) : [],
      )
      .filter((row) => row.projectId === projectId && !present.has(row.id) && !deleted.has(row.id));

    return carried.length ? { items: [...carried, ...read.items], total: read.total + carried.length } : read;
  };
};

/** One flat query per project scope; board and table views derive from it with select() or client-side filtering. */
export const tasksCanonicalOptions = ({ organizationId, tenantId, projectId }: { organizationId: string; tenantId: string; projectId: string }) => {
  return queryOptions({
    queryKey: taskKeys.list.home(organizationId, projectId),
    queryFn: async ({ client }) => {
      const completeRead = carryUnansweredCreates(client, projectId);
      const read = await fetchAllPages(
        ({ limit, offset }) =>
          getTasks({ path: { organizationId, tenantId }, query: { projectId, limit, offset, acceptedCutOff: boardAcceptedCutOffDays } }).then(
            liveItems,
          ),
        appConfig.requestLimits.tasks,
      );
      return completeRead(read);
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
      getTasks({ path: { organizationId, tenantId }, query: { ...filters, ...pageQuery(limit, offset) }, signal }).then(liveItems),
    ),
    refetchOnWindowFocus: false,
    meta: { persist: false },
    staleTime: syncStaleTime,
  });
};

/** Shared by the live hook and the offline-replay defaults: callbacks derive the org key from durable variables (onMutate skips replay). */
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
    // An in-place update keeps the DOM element and its glow; it inserts nothing, so a row an SSE delete removed mid-POST stays gone.
    cacheUpdate(taskKeys.list.org(variables.organizationId), createdTasks);
  },
  // Error-only: onSuccess patches the cache, SSE handles other users
  onSettled: (_data, error, variables) => {
    if (error) invalidateOrgLists(queryClient, variables.organizationId);
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

    // Cross-project move: the server's labels/assignedTo win over the cached ones
    const isProjectMove = variables.ops && 'projectId' in variables.ops;
    const merged = mergeServerResponse({
      cached,
      serverEntity: updatedTask,
      mutatedKeys,
      derivedKeys: { description: taskDerivedDescriptionFields, status: ['statusChangedAt'] },
      skipKeys: isProjectMove ? [] : ['labels', 'assignedTo'],
    });

    // The lite response path answers primaryLabel: null, so a merged response must never
    // supply it; rebuild the derived object from the cached label row the id points at.
    if (!isProjectMove && typeof variables.ops?.primaryLabelId === 'string') {
      const freshPrimary = findLabelInCache(variables.ops.primaryLabelId);
      if (freshPrimary) merged.primaryLabel = freshPrimary;
    }
    writeEntityToCache({ entity: merged, listKey: orgKey, detailKey, queryClient });
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateOrgLists(queryClient, variables.organizationId);
  },
});

const taskDeleteOptions = (queryClient: QueryClient): UseMutationOptions<DeleteData, Error, TaskDeleteFullVars, { tasksToDelete: Task[] }> => ({
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
    const rejectedSet = new Set(rejectedIds);
    // A replayed create or a list read may have put a row back while the delete waited, and its own echo fetches nothing.
    const deleted = variables.rows.filter((row) => !rejectedSet.has(row.id));
    cacheRemove(taskKeys.list.org(variables.organizationId), deleted);
    removeDetailQueriesById(
      queryClient,
      taskKeys.detail.base,
      deleted.map(({ id }) => id),
    );
    if (rejectedIds.length === 0) return;
    const rejectedTasks = variables.rows.filter((row) => rejectedSet.has(row.id));
    insertEntitiesIntoHome(queryClient, rejectedTasks);
    toaster.info(i18n.t('c:resources_delete_denied', { count: rejectedIds.length, total: variables.rows.length }));
  },
  onSettled: (data, error, variables) => {
    // A row put back is as the delete held it: remote changes were kept from the cache while it was pending.
    if (error || data?.rejectedIds?.length) invalidateOrgLists(queryClient, variables.organizationId);
  },
});

export const useTaskCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(taskCreateOptions(queryClient));

  // Inject org context + stx so a replay reuses the original mutation id and timestamps; callers pass the task data.
  const prepare = (input: TaskCreateMutationFnVariables): PreparedVars<TaskCreateFullVars> => ({
    kind: 'run',
    vars: { tenantId, organizationId, data: [input], stx: createStxForCreate() },
  });

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

export const useTaskUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(taskUpdateOptions(queryClient));

  // Folding into a queued create issues no update and patches the optimistic row here (onMutate won't run).
  const prepare = (input: TaskUpdateMutationFnVariables): PreparedVars<TaskUpdateFullVars> => {
    const { id: taskId, ops } = input;

    if (ops && squashIntoPendingCreate(queryClient, taskKeys.create, taskId, ops, taskCreateKeys)) {
      applyOptimisticTaskUpdate(queryClient, organizationId, { tenantId, organizationId, ...input });
      return { kind: 'coalesced' };
    }

    // squashPendingMutation keeps inherited fields' original timestamps so LWW arbitrates by intent time.
    const newStx = createStxForUpdate(scalarFieldNamesOf(ops));
    const { ops: mergedOps, stx } = ops ? squashPendingMutation(queryClient, taskKeys.update, taskId, ops, newStx) : { ops: {}, stx: newStx };

    return { kind: 'run', vars: { tenantId, organizationId, ...input, ops: mergedOps as typeof ops, stx } };
  };

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

export const useTaskDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(taskDeleteOptions(queryClient));

  const prepare = (tasks: Task[]): PreparedVars<TaskDeleteFullVars> =>
    prepareProductDelete(queryClient, taskKeys, taskKeys.list.org(organizationId), tasks, (rows) => ({
      tenantId,
      organizationId,
      rows,
      stx: createStxForDelete(),
    }));

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

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
  query: Omit<NonNullable<GetTasksData['query']>, 'limit' | 'offset' | 'afterSeq' | 'untilSeq'>;
}) => {
  const { limit, offset = 0, organizationId, tenantId, query } = params;
  const { items } = await getTasks({ query: { ...query, limit, offset }, path: { organizationId, tenantId } }).then(liveItems);
  return items;
};
