import { infiniteQueryOptions, type QueryClient, queryOptions, type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import {
  type CreateLabelsData,
  createLabels,
  deleteLabels,
  type GetLabelsData,
  getLabel,
  getLabels,
  type Label,
  type UpdateLabelData,
  updateLabel,
} from 'sdk';
import { zCreateLabelsBody, zLabel } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import { labelName } from 'shared/config/labels-config';
import { isRecord } from 'shared/utils/as-record';
import { registerYjsOwnedFields } from '~/modules/common/blocknote/yjs-editor';
import { toaster } from '~/modules/common/toaster/toaster';
import { insertEntitiesIntoHome } from '~/query/basic/apply-entity-to-lists';
import { cacheRemove, cacheUpdate, removeDetailQueriesById } from '~/query/basic/cache-mutations';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys } from '~/query/basic/entity-query-registry';
import { fetchAllPages } from '~/query/basic/fetch-all-pages';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { defaultOrderFor } from '~/query/basic/get-query-key-sort-order';
import { offsetPaging, pageQuery } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation, removePendingMutations } from '~/query/basic/invalidation-helpers';
import { syncStaleTime } from '~/query/basic/sync-stale-state';
import { addMutationRegistrar } from '~/query/mutation-registry';
import { type CreateVariables, type DeleteVariables, registerVariablesVersion, type UpdateVariables } from '~/query/offline/mutation-variables';
import { prepareProductDelete } from '~/query/offline/prepare-delete';
import { buildPreparedHandlers, type PreparedVars } from '~/query/offline/prepared-mutation';
import { squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
import { createStxForCreate, createStxForDelete, createStxForUpdate } from '~/query/offline/stx-utils';
import { mergeServerResponse, syncEntityToCache } from '~/query/offline/update-success-utils';
import { invalidateEmbeddingHosts, propagateEmbeddedProduct } from '~/query/realtime/propagation';
import { resolveQueryOrgTenantIds } from '~/query/realtime/sync-priority';
import { createResourceError } from '~/utils/resource-error';

export type { Label } from 'sdk';

type LabelCreateInput = Omit<CreateLabelsData['body'][number], 'stx'>;
type UpdateLabelBody = NonNullable<UpdateLabelData['body']>;
type UpdateLabelFields = UpdateLabelBody['ops'];
/** Public update input the hook accepts; the hook enriches it into durable variables. */
type UpdateLabelVars = { id: string; ops: UpdateLabelFields };

type CreateLabelFullVars = CreateVariables<LabelCreateInput>;
type UpdateLabelFullVars = UpdateVariables<UpdateLabelFields>;
type DeleteLabelVars = DeleteVariables<Label>;

type LabelFilters = Omit<NonNullable<GetLabelsData['query']>, 'limit' | 'offset' | 'afterSeq' | 'untilSeq'>;

const baseKeys = createEntityKeys<LabelFilters>('label');
const keys = {
  ...baseKeys,
  list: { ...baseKeys.list, filtered: (organizationId: string, filters: LabelFilters) => ['label', 'list', organizationId, filters] as const },
};
registerEntityQueryKeys('label', keys, ({ organizationId, tenantId, channelId, query }) => {
  return getLabels({ path: { tenantId: tenantId!, organizationId: organizationId! }, query: { ...query, projectId: channelId } });
});
/** Defines React Query cache keys for label. */
export const labelQueryKeys = keys;

/** The keys a create row takes. An edit of any other field cannot fold into a queued create. */
const labelCreateKeys = Object.keys(zCreateLabelsBody.element.shape);

// `keywords` is derived from the description, so it follows the description's stamp.
registerYjsOwnedFields('label', ['description', 'keywords']);

const labelsMutationKeyBase = ['label'] as const;
const handleError = createResourceError('label');

/** Look up a cached label entity by id across the org's label lists. */
export const findLabelInCache = createCacheFinder<Label>('label');

export const labelQueryOptions = (id: string, organizationId: string, tenantId: string) =>
  queryOptions({
    queryKey: keys.detail.byId(id),
    queryFn: () => getLabel({ path: { id, organizationId, tenantId } }),
    initialData: () => findLabelInCache(id),
  });

type LabelsListParams = Omit<NonNullable<GetLabelsData['query']>, 'limit' | 'offset' | 'afterSeq' | 'untilSeq'> &
  GetLabelsData['path'] & { limit?: number };

/**
 * Canonical label query: one flat list per project (labels are project-homed, `projectId notNull`),
 * stored at keys.list.home(organizationId, projectId). This is the row's canonical home list live
 * sync splices into; org/workspace-level views aggregate these per-project lists client-side (see
 * the label picker). staleTime follows sync liveness.
 */
export const labelsCanonicalOptions = ({ organizationId, tenantId, projectId }: { organizationId: string; tenantId: string; projectId: string }) => {
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
  modes,
  sort = 'name',
  order = defaultOrderFor(sort),
  limit = appConfig.requestLimits.labels,
  organizationId,
  tenantId,
}: LabelsListParams) => {
  const filters = { q, sort, order, modes, projectId, workspaceId };

  return infiniteQueryOptions({
    queryKey: keys.list.filtered(organizationId, filters),
    ...offsetPaging(limit, (offset, signal) =>
      getLabels({ query: { ...filters, ...pageQuery(limit, offset) }, path: { organizationId, tenantId }, signal }),
    ),
    meta: { persist: false },
    staleTime: syncStaleTime,
  });
};

// Shared by the interactive hooks and the offline-replay defaults, so a mutation resumed from
// persistence reconstructs the same request from durable variables alone. The `?? createStxFor*`
// fallback keeps queues persisted before stx became a durable variable replayable.

const createLabelMutationFn = async ({ tenantId, organizationId, data, stx }: CreateLabelFullVars) => {
  const effectiveStx = stx ?? createStxForCreate();
  const result = await createLabels({ body: data.map((row) => ({ ...row, stx: effectiveStx })), path: { organizationId, tenantId } });
  return result.data;
};

/** Sends one label update; exported for the replay test. */
export const updateLabelMutationFn = async ({ tenantId, organizationId, id, ops, stx }: UpdateLabelFullVars) => {
  const effectiveStx = stx ?? createStxForUpdate(ops ? Object.keys(ops) : []);
  return updateLabel({ body: { ops, stx: effectiveStx }, path: { id, organizationId, tenantId } });
};

const deleteLabelMutationFn = async ({ tenantId, organizationId, rows, stx }: DeleteLabelVars) => {
  const ids = rows.map(({ id }) => id);
  const effectiveStx = stx ?? createStxForDelete();
  return deleteLabels({ path: { organizationId, tenantId }, body: { ids, stx: effectiveStx } });
};

type CreateData = Awaited<ReturnType<typeof createLabelMutationFn>>;
type UpdateData = Awaited<ReturnType<typeof updateLabelMutationFn>>;
type DeleteData = Awaited<ReturnType<typeof deleteLabelMutationFn>>;

/**
 * Full options for one label op, shared by the live hook and the offline-replay defaults so a
 * replay reconciles like the live one. Callbacks take the QueryClient explicitly and derive the org
 * key from durable variables. On replay onMutate does not re-run, so onSettled invalidation recovers.
 */
const labelCreateOptions = (queryClient: QueryClient): UseMutationOptions<CreateData, Error, CreateLabelFullVars, { optimisticLabels: Label[] }> => ({
  mutationKey: keys.create,
  scope: { id: 'label' },
  mutationFn: createLabelMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ organizationId, data }) => {
    await queryClient.cancelQueries({ queryKey: keys.list.org(organizationId) });
    // organizationId lives on the request path, not the create body, so carry it onto the row: cache
    // placement resolves the canonical home list from the entity itself.
    const optimisticLabels = data.map((row) => createOptimisticEntity(zLabel, { ...row, organizationId }));
    // Insert into the label's canonical home (project) list only, never filtered/search lists.
    insertEntitiesIntoHome(queryClient, optimisticLabels);
    return { optimisticLabels };
  },
  onError: (error, variables, context) => {
    handleError('create', error);
    if (context?.optimisticLabels) cacheRemove(keys.list.org(variables.organizationId), context.optimisticLabels);
  },
  onSuccess: (createdLabels, variables, context) => {
    const orgKey = keys.list.org(variables.organizationId);
    if (context?.optimisticLabels) cacheRemove(orgKey, context.optimisticLabels);
    // Upsert into the canonical home (updates in place if a concurrent SSE already inserted it).
    insertEntitiesIntoHome(queryClient, createdLabels);
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
      // Refresh embedded copies on host products (e.g. task.labels) from the optimistic row
      propagateEmbeddedProduct('label', [id], 'update');
    }
    return { previousLabel };
  },
  onError: (error, variables, context) => {
    // Deleted while the update was under way: nothing to report, and a rollback would put the row back in the cache.
    if (context?.previousLabel && !findLabelInCache(context.previousLabel.id)) return;
    handleError('update', error);
    if (context?.previousLabel) {
      cacheUpdate(keys.list.org(variables.organizationId), [context.previousLabel]);
      queryClient.setQueryData(keys.detail.byId(context.previousLabel.id), context.previousLabel);
      // Embedded copies carry the optimistic edit and its newer updatedAt beats the restored
      // row in the propagation guard, so hosts recover through a refetch
      invalidateEmbeddingHosts('label', variables.organizationId);
    }
  },
  onSuccess: (updatedLabel, variables) => {
    const orgKey = keys.list.org(variables.organizationId);
    const cached = findLabelInCache(updatedLabel.id);
    const mutatedKeys = variables.ops ? Object.keys(variables.ops) : [];
    const merged = mergeServerResponse({ cached, serverEntity: updatedLabel, mutatedKeys, derivedKeys: { description: ['keywords'] } });
    syncEntityToCache({ entity: merged, listKey: orgKey, detailKey: keys.detail.byId(updatedLabel.id), queryClient });
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, keys.list.org(variables.organizationId));
  },
});

const labelDeleteOptions = (queryClient: QueryClient): UseMutationOptions<DeleteData, Error, DeleteLabelVars, { deletedLabels: Label[] }> => ({
  mutationKey: keys.delete,
  scope: { id: 'label' },
  mutationFn: deleteLabelMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ organizationId, rows }) => {
    const orgKey = keys.list.org(organizationId);
    const labelIds = rows.map(({ id }) => id);
    removePendingMutations(queryClient, keys.update, labelIds);
    await queryClient.cancelQueries({ queryKey: orgKey });
    cacheRemove(orgKey, rows);
    removeDetailQueriesById(queryClient, keys.detail.base, labelIds);
    // Strip embedded copies from host products (e.g. task.labels) so chips disappear immediately
    propagateEmbeddedProduct('label', labelIds, 'remove');
    return { deletedLabels: rows };
  },
  onError: (error, variables, context) => {
    handleError('delete', error);
    // Restore each row into its canonical home list only (updates in place elsewhere), never filtered lists.
    if (context?.deletedLabels) insertEntitiesIntoHome(queryClient, context.deletedLabels);
    // Propagation cannot re-insert stripped embedded copies, so hosts recover through a refetch
    invalidateEmbeddingHosts('label', variables.organizationId);
  },
  onSuccess: (result, variables) => {
    const rejectedIds = result?.rejectedIds ?? [];
    if (rejectedIds.length === 0) return;
    const rejectedSet = new Set(rejectedIds);
    const rejectedLabels = variables.rows.filter((row) => rejectedSet.has(row.id));
    insertEntitiesIntoHome(queryClient, rejectedLabels);
    toaster.info(i18n.t('c:resources_delete_denied', { count: rejectedIds.length, total: variables.rows.length }));
    invalidateEmbeddingHosts('label', variables.organizationId);
  },
  onSettled: (data, error, variables) => {
    // A row put back is as the delete held it: remote changes were kept from the cache while it was pending.
    if (error || data?.rejectedIds?.length) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, keys.list.org(variables.organizationId));
  },
});

/** Provides the React Query mutation for label create. */
export const useLabelCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(labelCreateOptions(queryClient));

  // Inject org context + stx so a replay reuses the original mutation id and timestamps; callers pass just the data.
  const prepare = (row: LabelCreateInput): PreparedVars<CreateLabelFullVars> => ({
    kind: 'run',
    vars: { tenantId, organizationId, data: [{ ...row, name: row.name && labelName(row.name, row.mode) }], stx: createStxForCreate() },
  });

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

/** Provides the React Query mutation for label update. */
export const useLabelUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(labelUpdateOptions(queryClient));

  /** Folding into a queued create issues no update and patches the optimistic row here (onMutate won't run). */
  const prepare = ({ id, ops: rawOps }: UpdateLabelVars): PreparedVars<UpdateLabelFullVars> => {
    // Lowercased here as well as on the server, so the optimistic rows (and task embeds) never show the typed casing
    const ops = rawOps.name ? { ...rawOps, name: labelName(rawOps.name, findLabelInCache(id)?.mode) } : rawOps;
    if (squashIntoPendingCreate(queryClient, keys.create, id, ops, labelCreateKeys)) {
      const cached = findLabelInCache(id);
      if (cached) {
        const optimisticLabel = { ...cached, ...ops, updatedAt: new Date().toISOString() };
        cacheUpdate(keys.list.org(organizationId), [optimisticLabel]);
        queryClient.setQueryData(keys.detail.byId(id), optimisticLabel);
        propagateEmbeddedProduct('label', [id], 'update');
      }
      return { kind: 'coalesced' };
    }
    const newStx = createStxForUpdate(Object.keys(ops));
    const { ops: mergedOps, stx } = squashPendingMutation(queryClient, keys.update, id, ops, newStx);
    return { kind: 'run', vars: { tenantId, organizationId, id, ops: mergedOps, stx } };
  };

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

/** Provides the React Query mutation for label delete. */
export const useLabelDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(labelDeleteOptions(queryClient));

  const prepare = (labels: Label[]): PreparedVars<DeleteLabelVars> =>
    prepareProductDelete(queryClient, keys, keys.list.org(organizationId), labels, (rows) => ({
      tenantId,
      organizationId,
      rows,
      stx: createStxForDelete(),
    }));

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

// Version 2 carries a create's rows as a list under `data` and a delete's under `rows`; version 1 queued a create's one row
// under `data` and a delete's rows as `labels`.
registerVariablesVersion(keys.create, 2, (variables) => {
  if (!isRecord(variables) || !isRecord(variables.data)) return null;
  return { ...variables, data: [variables.data] };
});
registerVariablesVersion(keys.delete, 2, (variables) => {
  if (!isRecord(variables) || !Array.isArray(variables.labels)) return null;
  const { labels, ...rest } = variables;
  return { ...rest, rows: labels };
});
