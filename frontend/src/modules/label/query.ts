import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  type UseMutationOptions,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type CreateLabelsData,
  createLabels,
  deleteLabels,
  type GetLabelsData,
  getLabel,
  getLabels,
  type Label,
  type StxBase,
  type UpdateLabelData,
  updateLabel,
} from 'sdk';
import { zLabel } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import { insertEntitiesIntoHome } from '~/query/basic/apply-entity-to-lists';
import { cacheRemove, cacheUpdate } from '~/query/basic/cache-mutations';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys, SYNC_CHUNK_SIZE } from '~/query/basic/entity-query-registry';
import { fetchAllPages } from '~/query/basic/fetch-all-pages';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { baseInfiniteQueryOptions } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation, removePendingMutations } from '~/query/basic/invalidation-helpers';
import { syncStaleTime } from '~/query/basic/sync-stale-config';
import { addMutationRegistrar } from '~/query/mutation-registry';
import { type PreparedVars, usePreparedMutation } from '~/query/offline/prepared-mutation';
import { removePausedCreates, squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
import { createStxForCreate, createStxForDelete, createStxForUpdate } from '~/query/offline/stx-utils';
import { mergeServerResponse, syncEntityToCache } from '~/query/offline/update-success-utils';
import { getRouteOrgId, getRouteTenantId } from '~/query/realtime/sync-priority';
import type { QueryOrgContext } from '~/query/types';
import { createResourceError } from '~/utils/resource-error';

export type { Label } from 'sdk';

type LabelCreateInput = Omit<CreateLabelsData['body'][number], 'stx'>;
type UpdateLabelBody = NonNullable<UpdateLabelData['body']>;
type UpdateLabelFields = UpdateLabelBody['ops'];
/** Public update input the hook accepts; the hook enriches it into durable variables. */
type UpdateLabelVars = { id: string; ops: UpdateLabelFields };

// Durable mutation variables: carry tenant/org context AND stx so a mutation replayed from the
// persisted queue after a reload (component closure gone) reconstructs the same request. stx is
// minted at intent time so a replay reuses the original mutationId and field timestamps (LWW must
// arbitrate by intent time). The `?? createStxFor*` fallback in each fn keeps old queues replayable.
type CreateLabelFullVars = QueryOrgContext & { data: LabelCreateInput; stx?: StxBase };
type UpdateLabelFullVars = QueryOrgContext & UpdateLabelVars & { stx?: StxBase };
type DeleteLabelVars = QueryOrgContext & { labels: Label[]; stx?: StxBase };

const labelsLimit = appConfig.requestLimits.labels;

type LabelFilters = Omit<NonNullable<GetLabelsData['query']>, 'limit' | 'offset'>;

const baseKeys = createEntityKeys<LabelFilters>('label');
const keys = {
  ...baseKeys,
  list: {
    ...baseKeys.list,
    filtered: (organizationId: string, filters: LabelFilters) => ['label', 'list', organizationId, filters] as const,
  },
};
registerEntityQueryKeys('label', keys, (organizationId, tenantId, seqCursor, pathPrefix) => {
  return getLabels({
    path: { tenantId: tenantId!, organizationId: organizationId! },
    query: { seqCursor, pathPrefix, limit: String(SYNC_CHUNK_SIZE) },
  });
});
export const labelQueryKeys = keys;

const labelsMutationKeyBase = ['label'] as const;
const handleError = createResourceError('label');

const findLabelInCache = createCacheFinder<Label>('label');

// --- Query options ---

export const labelQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: keys.detail.byId(id),
    queryFn: async () => {
      return getLabel({
        path: { id, organizationId, tenantId },
      });
    },
    initialData: () => findLabelInCache(id),
  });

type LabelsListParams = Omit<NonNullable<GetLabelsData['query']>, 'limit' | 'offset'> &
  GetLabelsData['path'] & { limit?: number };

/**
 * Canonical label query: one flat list per project (labels are project-homed, `projectId notNull`),
 * stored at keys.list.home(organizationId, projectId). This is the row's canonical home list live
 * sync splices into; org/workspace-level views aggregate these per-project lists client-side (see
 * the label picker). staleTime follows sync liveness.
 */
export const labelsCanonicalOptions = ({
  organizationId,
  tenantId,
  projectId,
}: {
  organizationId: string;
  tenantId: string;
  projectId: string;
}) => {
  return queryOptions({
    queryKey: keys.list.home(organizationId, projectId),
    queryFn: async () => {
      return fetchAllPages(
        ({ limit, offset }) =>
          getLabels({
            path: { organizationId, tenantId },
            query: { projectId, limit, offset },
          }),
        labelsLimit,
      );
    },
    staleTime: syncStaleTime,
  });
};

export const labelsQueryOptions = ({
  q = '',
  projectId,
  workspaceId,
  sort = 'name',
  order = 'desc',
  limit: baseLimit = labelsLimit,
  organizationId,
  tenantId,
}: LabelsListParams) => {
  const limit = String(baseLimit);
  const keyFilters = { q, sort, order, projectId, workspaceId };
  const queryKey = keys.list.filtered(organizationId, keyFilters);

  return infiniteQueryOptions({
    queryKey,
    queryFn: async ({ pageParam: { page, offset: _offset }, signal }) => {
      const offset = String(_offset ?? (page ?? 0) * Number(limit));
      return getLabels({
        query: { q, sort, order, projectId, workspaceId, limit, offset },
        path: { organizationId, tenantId },
        signal,
      });
    },
    ...baseInfiniteQueryOptions,
    meta: { persist: false },
    staleTime: syncStaleTime,
  });
};

// --- Mutation fns ---
// Shared by the interactive hooks and the offline-replay defaults, so a mutation resumed from
// persistence reconstructs the same request from durable variables alone.

const createLabelMutationFn = async ({ tenantId, organizationId, data, stx }: CreateLabelFullVars) => {
  const effectiveStx = stx ?? createStxForCreate();
  const result = await createLabels({ body: [{ ...data, stx: effectiveStx }], path: { organizationId, tenantId } });
  return result.data[0];
};

const updateLabelMutationFn = async ({ tenantId, organizationId, id, ops, stx }: UpdateLabelFullVars) => {
  const effectiveStx = stx ?? createStxForUpdate(ops ? Object.keys(ops) : []);
  return updateLabel({ body: { ops, stx: effectiveStx }, path: { id, organizationId, tenantId } });
};

const deleteLabelMutationFn = async ({ tenantId, organizationId, labels, stx }: DeleteLabelVars) => {
  const ids = labels.map(({ id }) => id);
  const effectiveStx = stx ?? createStxForDelete();
  await deleteLabels({ path: { organizationId, tenantId }, body: { ids, stx: effectiveStx } });
};

type CreateData = Awaited<ReturnType<typeof createLabelMutationFn>>;
type UpdateData = Awaited<ReturnType<typeof updateLabelMutationFn>>;
type DeleteData = Awaited<ReturnType<typeof deleteLabelMutationFn>>;

// --- Mutation options ---
// Full options (not just mutationFn) shared by the live hook and the offline-replay defaults, so a
// replayed mutation runs the same reconciliation callbacks. Callbacks derive the org key from
// durable variables; on replay onMutate does not re-run, so onSettled invalidation recovers.

const labelCreateOptions = (
  queryClient: QueryClient,
): UseMutationOptions<CreateData, Error, CreateLabelFullVars, { optimisticLabel: Label }> => ({
  mutationKey: keys.create,
  scope: { id: 'label' },
  mutationFn: createLabelMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ organizationId, data }) => {
    await queryClient.cancelQueries({ queryKey: keys.list.org(organizationId) });
    const optimisticLabel = createOptimisticEntity(zLabel, data);
    // Insert into the label's canonical home (project) list only, never filtered/search lists.
    insertEntitiesIntoHome(queryClient, { entityType: 'label', entities: [optimisticLabel], keys, organizationId });
    return { optimisticLabel };
  },
  onError: (_err, variables, context) => {
    handleError('create');
    if (context?.optimisticLabel) cacheRemove(keys.list.org(variables.organizationId), [context.optimisticLabel]);
  },
  onSuccess: (createdLabel, variables, context) => {
    const orgKey = keys.list.org(variables.organizationId);
    if (context?.optimisticLabel) cacheRemove(orgKey, [context.optimisticLabel]);
    // Upsert into the canonical home (updates in place if a concurrent SSE already inserted it).
    insertEntitiesIntoHome(queryClient, {
      entityType: 'label',
      entities: [createdLabel],
      keys,
      organizationId: variables.organizationId,
    });
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, keys.list.org(variables.organizationId));
  },
});

const labelUpdateOptions = (
  queryClient: QueryClient,
): UseMutationOptions<UpdateData, Error, UpdateLabelFullVars, { previousLabel: Label | undefined }> => ({
  mutationKey: keys.update,
  // Same scope as create/delete: label writes serialize, so a squashed update never replays before its queued create.
  scope: { id: 'label' },
  mutationFn: updateLabelMutationFn,
  meta: { suppressGlobalErrorToast: true },
  // Squash/coalesce runs in the hook's prepare step, so variables already carry the merge; onMutate keeps only cache work.
  onMutate: async ({ organizationId, id, ops }) => {
    const orgKey = keys.list.org(organizationId);
    await queryClient.cancelQueries({ queryKey: orgKey });
    await queryClient.cancelQueries({ queryKey: keys.detail.byId(id) });
    const previousLabel = findLabelInCache(id);
    if (previousLabel) {
      const optimisticLabel = { ...previousLabel, ...ops, updatedAt: new Date().toISOString() };
      cacheUpdate(orgKey, [optimisticLabel]);
      queryClient.setQueryData(keys.detail.byId(id), optimisticLabel);
    }
    return { previousLabel };
  },
  onError: (_err, variables, context) => {
    handleError('update');
    if (context?.previousLabel) {
      cacheUpdate(keys.list.org(variables.organizationId), [context.previousLabel]);
      queryClient.setQueryData(keys.detail.byId(context.previousLabel.id), context.previousLabel);
    }
  },
  onSuccess: (updatedLabel, variables) => {
    const orgKey = keys.list.org(variables.organizationId);
    const cached = findLabelInCache(updatedLabel.id);
    const mutatedKeys = variables.ops ? Object.keys(variables.ops) : [];
    const merged = mergeServerResponse({ cached, serverEntity: updatedLabel, mutatedKeys });
    syncEntityToCache({ entity: merged, listKey: orgKey, detailKey: keys.detail.byId(updatedLabel.id), queryClient });
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, keys.list.org(variables.organizationId));
  },
});

const labelDeleteOptions = (
  queryClient: QueryClient,
): UseMutationOptions<DeleteData, Error, DeleteLabelVars, { deletedLabels: Label[] }> => ({
  mutationKey: keys.delete,
  scope: { id: 'label' },
  mutationFn: deleteLabelMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ organizationId, labels }) => {
    const orgKey = keys.list.org(organizationId);
    removePendingMutations(
      queryClient,
      keys.update,
      labels.map((l) => l.id),
    );
    await queryClient.cancelQueries({ queryKey: orgKey });
    cacheRemove(orgKey, labels);
    for (const { id } of labels) queryClient.removeQueries({ queryKey: keys.detail.byId(id) });
    return { deletedLabels: labels };
  },
  onError: (_err, variables, context) => {
    handleError('delete');
    // Restore each row into its canonical home list only (updates in place elsewhere), never filtered lists.
    if (context?.deletedLabels)
      insertEntitiesIntoHome(queryClient, {
        entityType: 'label',
        entities: context.deletedLabels,
        keys,
        organizationId: variables.organizationId,
      });
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, keys.list.org(variables.organizationId));
  },
});

// --- Mutation hooks ---

export const useLabelCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  // Inject org context + stx so a replay reuses the original mutation id and timestamps; callers pass just the data.
  return usePreparedMutation<CreateData, Error, CreateLabelFullVars, { optimisticLabel: Label }, LabelCreateInput>(
    labelCreateOptions(queryClient),
    (data) => ({ kind: 'run', vars: { tenantId, organizationId, data, stx: createStxForCreate() } }),
  );
};

export const useLabelUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();

  /**
   * Squash/coalesce before the mutation exists so the request carries the merge. Folding into a
   * queued create issues no update and patches the optimistic row here (onMutate won't run).
   */
  const prepare = ({ id, ops }: UpdateLabelVars): PreparedVars<UpdateLabelFullVars> => {
    if (squashIntoPendingCreate(queryClient, keys.create, id, ops as Record<string, unknown>)) {
      const cached = findLabelInCache(id);
      if (cached) {
        const optimisticLabel = { ...cached, ...ops, updatedAt: new Date().toISOString() };
        cacheUpdate(keys.list.org(organizationId), [optimisticLabel]);
        queryClient.setQueryData(keys.detail.byId(id), optimisticLabel);
      }
      return { kind: 'coalesced' };
    }
    // Coalesce queued offline edits; squashPendingMutation keeps each inherited field's original
    // timestamp so LWW arbitrates by intent time, and only the changed fields carry this edit's stamps.
    const newStx = createStxForUpdate(Object.keys(ops));
    const { ops: mergedOps, stx } = squashPendingMutation(
      queryClient,
      keys.update,
      id,
      ops as Record<string, unknown>,
      newStx,
    );
    return { kind: 'run', vars: { tenantId, organizationId, id, ops: mergedOps as UpdateLabelFields, stx } };
  };

  return usePreparedMutation<
    UpdateData,
    Error,
    UpdateLabelFullVars,
    { previousLabel: Label | undefined },
    UpdateLabelVars
  >(labelUpdateOptions(queryClient), prepare);
};

export const useLabelDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();

  /**
   * Cancel queued creates for labels deleted while offline (they never reached the server), clear
   * their queued updates, finish deletion cache-side, and keep them out of the request. `noop` when
   * nothing remains.
   */
  const prepare = (labels: Label[]): PreparedVars<DeleteLabelVars> => {
    const cancelled = new Set(
      removePausedCreates(
        queryClient,
        keys.create,
        labels.map((l) => l.id),
      ),
    );
    const localOnly = labels.filter((l) => cancelled.has(l.id));
    if (localOnly.length > 0) {
      removePendingMutations(
        queryClient,
        keys.update,
        localOnly.map((l) => l.id),
      );
      cacheRemove(keys.list.org(organizationId), localOnly);
      for (const { id } of localOnly) queryClient.removeQueries({ queryKey: keys.detail.byId(id) });
    }
    const remaining = labels.filter((l) => !cancelled.has(l.id));
    if (remaining.length === 0) return { kind: 'noop' };
    return { kind: 'run', vars: { tenantId, organizationId, labels: remaining, stx: createStxForDelete() } };
  };

  return usePreparedMutation<DeleteData, Error, DeleteLabelVars, { deletedLabels: Label[] }, Label[]>(
    labelDeleteOptions(queryClient),
    prepare,
  );
};

// --- Mutation defaults (offline persistence) ---

addMutationRegistrar((queryClient: QueryClient) => {
  queryClient.setQueryDefaults(keys.detail.base, {
    queryFn: ({ queryKey, meta }) => {
      const id = queryKey[2] as string;
      const cached = findLabelInCache(id);
      const organizationId = (meta?.organizationId as string) ?? cached?.organizationId ?? getRouteOrgId();
      const tenantId = (meta?.tenantId as string) ?? cached?.tenantId ?? getRouteTenantId();
      if (!organizationId || !tenantId) throw new Error('Cannot resolve organizationId/tenantId for label fetch');
      return getLabel({
        path: { id, organizationId, tenantId },
      });
    },
  });

  // The SAME full options the hooks use (not just mutationFn), so a replayed mutation runs the same reconciliation callbacks.
  queryClient.setMutationDefaults(keys.create, labelCreateOptions(queryClient));
  queryClient.setMutationDefaults(keys.update, labelUpdateOptions(queryClient));
  queryClient.setMutationDefaults(keys.delete, labelDeleteOptions(queryClient));
});
