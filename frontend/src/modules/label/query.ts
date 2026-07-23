import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  type UseMutationOptions,
  useMutation,
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
import { cacheRemove, cacheUpdate, removeDetailQueriesById } from '~/query/basic/cache-mutations';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys, SYNC_CHUNK_SIZE } from '~/query/basic/entity-query-registry';
import { fetchAllPages } from '~/query/basic/fetch-all-pages';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { baseInfiniteQueryOptions } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation, removePendingMutations } from '~/query/basic/invalidation-helpers';
import { syncStaleTime } from '~/query/basic/sync-stale-config';
import { addMutationRegistrar } from '~/query/mutation-registry';
import { buildPreparedHandlers, type PreparedVars } from '~/query/offline/prepared-mutation';
import { removePausedCreates, squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
import { createStxForCreate, createStxForDelete, createStxForUpdate } from '~/query/offline/stx-utils';
import { mergeServerResponse, syncEntityToCache } from '~/query/offline/update-success-utils';
import { resolveQueryOrgTenantIds } from '~/query/realtime/sync-priority';
import type { QueryOrgContext } from '~/query/types';
import { createResourceError } from '~/utils/resource-error';

export type { Label } from 'sdk';

type LabelCreateInput = Omit<CreateLabelsData['body'][number], 'stx'>;
type UpdateLabelBody = NonNullable<UpdateLabelData['body']>;
type UpdateLabelFields = UpdateLabelBody['ops'];
/** Public update input the hook accepts; the hook enriches it into durable variables. */
type UpdateLabelVars = { id: string; ops: UpdateLabelFields };

type CreateLabelFullVars = QueryOrgContext & { data: LabelCreateInput; stx?: StxBase };
type UpdateLabelFullVars = QueryOrgContext & UpdateLabelVars & { stx?: StxBase };
type DeleteLabelVars = QueryOrgContext & { labels: Label[]; stx?: StxBase };

type LabelFilters = Omit<NonNullable<GetLabelsData['query']>, 'limit' | 'offset'>;

const baseKeys = createEntityKeys<LabelFilters>('label');
const keys = {
  ...baseKeys,
  list: {
    ...baseKeys.list,
    filtered: (organizationId: string, filters: LabelFilters) => ['label', 'list', organizationId, filters] as const,
  },
};
registerEntityQueryKeys('label', keys, (organizationId, tenantId, seqCursor, channelId) => {
  return getLabels({
    path: { tenantId: tenantId!, organizationId: organizationId! },
    query: { seqCursor, projectId: channelId, limit: String(SYNC_CHUNK_SIZE) },
  });
});
export const labelQueryKeys = keys;

const labelsMutationKeyBase = ['label'] as const;
const handleError = createResourceError('label');

const findLabelInCache = createCacheFinder<Label>('label');

export const labelQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: keys.detail.byId(id),
    queryFn: () => getLabel({ path: { id, organizationId, tenantId } }),
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
    queryFn: () => {
      return fetchAllPages(
        ({ limit, offset }) => getLabels({ path: { organizationId, tenantId }, query: { projectId, limit, offset } }),
        appConfig.requestLimits.labels,
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
  limit = appConfig.requestLimits.labels,
  organizationId,
  tenantId,
}: LabelsListParams) => {
  const filters = { q, sort, order, projectId, workspaceId };
  const requestQuery = { ...filters, limit: String(limit) };

  return infiniteQueryOptions({
    queryKey: keys.list.filtered(organizationId, filters),
    queryFn: ({ pageParam: { page, offset }, signal }) => {
      const requestOffset = String(offset ?? (page ?? 0) * limit);

      return getLabels({
        query: { ...requestQuery, offset: requestOffset },
        path: { organizationId, tenantId },
        signal,
      });
    },
    ...baseInfiniteQueryOptions,
    meta: { persist: false },
    staleTime: syncStaleTime,
  });
};

// Shared by the interactive hooks and the offline-replay defaults, so a mutation resumed from
// persistence reconstructs the same request from durable variables alone. The `?? createStxFor*`
// fallback keeps queues persisted before stx became a durable variable replayable.

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

/**
 * Full options for one label op, shared by the live hook and the offline-replay defaults so a
 * replay reconciles like the live one. Callbacks take the QueryClient explicitly and derive the org
 * key from durable variables. On replay onMutate does not re-run, so onSettled invalidation recovers.
 */
const labelCreateOptions = (
  queryClient: QueryClient,
): UseMutationOptions<CreateData, Error, CreateLabelFullVars, { optimisticLabel: Label }> => ({
  mutationKey: keys.create,
  scope: { id: 'label' },
  mutationFn: createLabelMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ organizationId, data }) => {
    await queryClient.cancelQueries({ queryKey: keys.list.org(organizationId) });
    // organizationId lives on the request path, not the create body, so carry it onto the row: cache
    // placement resolves the canonical home list from the entity itself.
    const optimisticLabel = createOptimisticEntity(zLabel, { ...data, organizationId });
    // Insert into the label's canonical home (project) list only, never filtered/search lists.
    insertEntitiesIntoHome(queryClient, [optimisticLabel]);
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
    insertEntitiesIntoHome(queryClient, [createdLabel]);
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
    const labelIds = labels.map(({ id }) => id);
    removePendingMutations(queryClient, keys.update, labelIds);
    await queryClient.cancelQueries({ queryKey: orgKey });
    cacheRemove(orgKey, labels);
    removeDetailQueriesById(queryClient, keys.detail.base, labelIds);
    return { deletedLabels: labels };
  },
  onError: (_err, _variables, context) => {
    handleError('delete');
    // Restore each row into its canonical home list only (updates in place elsewhere), never filtered lists.
    if (context?.deletedLabels) insertEntitiesIntoHome(queryClient, context.deletedLabels);
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, keys.list.org(variables.organizationId));
  },
});

export const useLabelCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(labelCreateOptions(queryClient));

  // Inject org context + stx so a replay reuses the original mutation id and timestamps; callers pass just the data.
  const prepare = (data: LabelCreateInput): PreparedVars<CreateLabelFullVars> => ({
    kind: 'run',
    vars: { tenantId, organizationId, data, stx: createStxForCreate() },
  });

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

export const useLabelUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(labelUpdateOptions(queryClient));

  /** Folding into a queued create issues no update and patches the optimistic row here (onMutate won't run). */
  const prepare = ({ id, ops }: UpdateLabelVars): PreparedVars<UpdateLabelFullVars> => {
    if (squashIntoPendingCreate(queryClient, keys.create, id, ops)) {
      const cached = findLabelInCache(id);
      if (cached) {
        const optimisticLabel = { ...cached, ...ops, updatedAt: new Date().toISOString() };
        cacheUpdate(keys.list.org(organizationId), [optimisticLabel]);
        queryClient.setQueryData(keys.detail.byId(id), optimisticLabel);
      }
      return { kind: 'coalesced' };
    }
    const newStx = createStxForUpdate(Object.keys(ops));
    const { ops: mergedOps, stx } = squashPendingMutation(queryClient, keys.update, id, ops, newStx);
    return { kind: 'run', vars: { tenantId, organizationId, id, ops: mergedOps, stx } };
  };

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

export const useLabelDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(labelDeleteOptions(queryClient));

  /** Labels deleted while offline never reached the server: cancel their queued work and keep them out of the request. */
  const prepare = (labels: Label[]): PreparedVars<DeleteLabelVars> => {
    const labelIds = labels.map(({ id }) => id);
    const cancelled = new Set(removePausedCreates(queryClient, keys.create, labelIds));

    if (cancelled.size > 0) {
      const localOnly = labels.filter((l) => cancelled.has(l.id));
      const localOnlyIds = localOnly.map(({ id }) => id);
      removePendingMutations(queryClient, keys.update, localOnlyIds);
      cacheRemove(keys.list.org(organizationId), localOnly);
      removeDetailQueriesById(queryClient, keys.detail.base, localOnlyIds);
    }

    const remaining = labels.filter((l) => !cancelled.has(l.id));
    if (remaining.length === 0) return { kind: 'noop' };
    return { kind: 'run', vars: { tenantId, organizationId, labels: remaining, stx: createStxForDelete() } };
  };

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

// Mutation defaults (offline persistence)

addMutationRegistrar((queryClient: QueryClient) => {
  queryClient.setQueryDefaults(keys.detail.base, {
    queryFn: ({ queryKey, meta }) => {
      const id = queryKey[2] as string;
      const cached = findLabelInCache(id);
      const { organizationId, tenantId } = resolveQueryOrgTenantIds(meta, cached, 'label');
      return getLabel({ path: { id, organizationId, tenantId } });
    },
  });

  queryClient.setMutationDefaults(keys.create, labelCreateOptions(queryClient));
  queryClient.setMutationDefaults(keys.update, labelUpdateOptions(queryClient));
  queryClient.setMutationDefaults(keys.delete, labelDeleteOptions(queryClient));
});
