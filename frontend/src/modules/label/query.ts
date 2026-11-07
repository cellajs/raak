import { type QueryClient, queryOptions, type UseMutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import {
  type CreateLabelsData,
  createLabels,
  deleteLabels,
  type GetLabelsData,
  getLabel,
  getLabelOlderAcceptedCounts,
  getLabels,
  type Label,
  type UpdateLabelData,
  updateLabel,
} from 'sdk';
import { zCreateLabelsBody, zLabel } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import { labelName } from 'shared/config/labels-config';
import { registerDescriptionColumns } from '~/modules/common/blocknote/yjs-owned-fields';
import { toaster } from '~/modules/common/toaster/toaster';
import { insertEntitiesIntoHome } from '~/query/basic/apply-entity-to-lists';
import { cacheRemove, cacheUpdate, cancelKeepingMark, removeDetailQueriesById, writeKeepingMark } from '~/query/basic/cache-mutations';
import { createOptimisticEntity } from '~/query/basic/create-optimistic';
import { createEntityKeys } from '~/query/basic/create-query-keys';
import { registerEntityQueryKeys } from '~/query/basic/entity-query-registry';
import { fetchAllPages } from '~/query/basic/fetch-all-pages';
import { createCacheFinder } from '~/query/basic/find-in-list-cache';
import { liveItems } from '~/query/basic/infinite-query-options';
import { invalidateIfLastMutation, removePendingMutations } from '~/query/basic/invalidation-helpers';
import { isQueryData } from '~/query/basic/mutate-query';
import { syncStaleTime } from '~/query/basic/sync-stale-state';
import { syncedListOptions } from '~/query/basic/synced-list-options';
import type { CreateVariables, DeleteVariables, UpdateVariables } from '~/query/offline/mutation-variables';
import { prepareProductDelete } from '~/query/offline/prepare-delete';
import { buildPreparedHandlers, type PreparedVars } from '~/query/offline/prepared-mutation';
import { squashIntoPendingCreate, squashPendingMutation } from '~/query/offline/squash-utils';
import { createStxForCreate, createStxForDelete, createStxForUpdate } from '~/query/offline/stx-utils';
import { mergeServerResponse, writeEntityToCache } from '~/query/offline/update-success-utils';
import { queryClient } from '~/query/query-client';
import { invalidateEmbeddingHosts, propagateEmbeddedProduct } from '~/query/realtime/propagation';
import { resolveQueryOrgTenantIds } from '~/query/realtime/sync-priority';
import { createResourceError } from '~/utils/resource-error';

export type { Label } from 'sdk';

type LabelCreateInput = Omit<CreateLabelsData['body'][number], 'stx'>;
type UpdateLabelBody = NonNullable<UpdateLabelData['body']>;
type UpdateLabelFields = UpdateLabelBody['ops'];
/** The hook enriches this public input into durable variables. */
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

/** The keys a create row takes. An edit of any other field cannot fold into a queued create. */
const labelCreateKeys = Object.keys(zCreateLabelsBody.element.shape);

// The column `update-label.ts` stores from a description.
registerDescriptionColumns('label', ['keywords']);

const handleError = createResourceError('label');

/** Refetches the organization's lists once no other label mutation is pending. */
const invalidateOrgLists = (queryClient: QueryClient, organizationId: string) =>
  invalidateIfLastMutation(queryClient, keys.all, keys.list.org(organizationId));

const patchCachedLabel = (queryClient: QueryClient, organizationId: string, row: Label, ops: UpdateLabelFields) => {
  const patched = { ...row, ...ops, updatedAt: new Date().toISOString() };
  cacheUpdate(keys.list.org(organizationId), [patched]);
  writeKeepingMark(queryClient, keys.detail.byId(row.id), () => patched);
  propagateEmbeddedProduct('label', [row.id], 'update');
};

export const findLabelInCache = createCacheFinder<Label>('label');

/** The slugs of a project's labels in the cache; none until its list has loaded. */
export const cachedLabelSlugs = (organizationId: string, projectId: string): string[] => {
  const data = queryClient.getQueryData(keys.list.home(organizationId, projectId));
  return isQueryData<Label>(data) ? data.items.map(({ slug }) => slug) : [];
};

/**
 * One flat list per project (labels are project-homed): the canonical home list live sync splices into.
 * Org and workspace views aggregate these per-project lists client-side.
 */
export const labelsCanonicalOptions = ({ organizationId, tenantId, projectId }: { organizationId: string; tenantId: string; projectId: string }) => {
  return syncedListOptions(
    queryOptions({
      queryKey: keys.list.home(organizationId, projectId),
      queryFn: () => {
        return fetchAllPages(
          ({ limit, offset }) => getLabels({ path: { organizationId, tenantId }, query: { projectId, limit, offset } }).then(liveItems),
          appConfig.requestLimits.labels,
        );
      },
      staleTime: syncStaleTime,
    }),
    { organizationId, tenantId, channelId: projectId },
  );
};

/**
 * Label id → how many of a project's tasks were accepted before `acceptedCutOff` days ago: the done tasks a board list leaves out.
 * Those tasks are old, so a count goes stale only when one is reopened; a few minutes' staleness is fine.
 */
export const labelOlderAcceptedCountsOptions = ({
  organizationId,
  tenantId,
  projectId,
  acceptedCutOff,
}: {
  organizationId: string;
  tenantId: string;
  projectId: string;
  acceptedCutOff: number;
}) =>
  queryOptions({
    queryKey: ['label', 'older-accepted-counts', organizationId, projectId, acceptedCutOff] as const,
    queryFn: () => getLabelOlderAcceptedCounts({ path: { organizationId, tenantId }, query: { projectId, acceptedCutOff } }),
    staleTime: 5 * 60 * 1000,
  });

const createLabelMutationFn = async ({ tenantId, organizationId, data, stx }: CreateLabelFullVars) => {
  const result = await createLabels({ body: data.map((row) => ({ ...row, stx })), path: { organizationId, tenantId } });
  return result.data;
};

/** Sends one label update; exported for the replay test. */
export const updateLabelMutationFn = async ({ tenantId, organizationId, id, ops, stx }: UpdateLabelFullVars) => {
  return updateLabel({ body: { ops, stx }, path: { id, organizationId, tenantId } });
};

const deleteLabelMutationFn = async ({ tenantId, organizationId, rows, stx }: DeleteLabelVars) => {
  return deleteLabels({ path: { organizationId, tenantId }, body: { ids: rows.map(({ id }) => id), stx } });
};

type CreateData = Awaited<ReturnType<typeof createLabelMutationFn>>;
type UpdateData = Awaited<ReturnType<typeof updateLabelMutationFn>>;
type DeleteData = Awaited<ReturnType<typeof deleteLabelMutationFn>>;

/**
 * Shared by the live hooks and the offline-replay defaults. Callbacks derive the org key from durable variables;
 * onMutate does not re-run on replay, so onSettled invalidation recovers.
 */
const labelCreateOptions = (queryClient: QueryClient): UseMutationOptions<CreateData, Error, CreateLabelFullVars, { optimisticLabels: Label[] }> => ({
  mutationKey: keys.create,
  scope: { id: 'label' },
  mutationFn: createLabelMutationFn,
  meta: { suppressGlobalErrorToast: true },
  onMutate: async ({ tenantId, organizationId, data }) => {
    await cancelKeepingMark(queryClient, keys.list.org(organizationId));
    // The ids live on the request path, not the create body, so carry them onto the row: cache placement resolves the
    // canonical home list from the entity itself, and a delete takes its path from it.
    const optimisticLabels = data.map((row) => createOptimisticEntity(zLabel, { ...row, tenantId, organizationId }));
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
    // Updates in place when a concurrent SSE already inserted it.
    insertEntitiesIntoHome(queryClient, createdLabels);
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateOrgLists(queryClient, variables.organizationId);
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
    await cancelKeepingMark(queryClient, orgKey);
    await cancelKeepingMark(queryClient, keys.detail.byId(id));
    const previousLabel = findLabelInCache(id);
    if (previousLabel) patchCachedLabel(queryClient, organizationId, previousLabel, ops);
    return { previousLabel };
  },
  onError: (error, variables, context) => {
    // Deleted while the update was under way: nothing to report, and a rollback would put the row back in the cache.
    if (context?.previousLabel && !findLabelInCache(context.previousLabel.id)) return;
    handleError('update', error);
    if (context?.previousLabel) {
      cacheUpdate(keys.list.org(variables.organizationId), [context.previousLabel]);
      writeKeepingMark(queryClient, keys.detail.byId(context.previousLabel.id), () => context.previousLabel);
      // Embedded copies carry the optimistic edit and its newer updatedAt beats the restored
      // row in the propagation guard, so hosts recover through a refetch
      invalidateEmbeddingHosts('label', variables.organizationId);
    }
  },
  onSuccess: (updatedLabel, variables) => {
    const orgKey = keys.list.org(variables.organizationId);
    const cached = findLabelInCache(updatedLabel.id);
    const mutatedKeys = variables.ops ? Object.keys(variables.ops) : [];
    const merged = mergeServerResponse({ queryClient, cached, serverEntity: updatedLabel, mutatedKeys });
    writeEntityToCache({ entity: merged, listKey: orgKey, detailKey: keys.detail.byId(updatedLabel.id), queryClient });
  },
  onSettled: (_data, error, variables) => {
    if (error) invalidateOrgLists(queryClient, variables.organizationId);
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
    await cancelKeepingMark(queryClient, orgKey);
    cacheRemove(orgKey, rows);
    removeDetailQueriesById(queryClient, keys.detail.base, labelIds);
    propagateEmbeddedProduct('label', labelIds, 'remove');
    return { deletedLabels: rows };
  },
  onError: (error, variables, context) => {
    handleError('delete', error);
    if (context?.deletedLabels) insertEntitiesIntoHome(queryClient, context.deletedLabels);
    // Propagation cannot re-insert stripped embedded copies, so hosts recover through a refetch
    invalidateEmbeddingHosts('label', variables.organizationId);
  },
  onSuccess: (result, variables) => {
    const rejectedIds = result?.rejectedIds ?? [];
    const rejectedSet = new Set(rejectedIds);
    // A replayed create or a list read may have put a row back while the delete waited, and its own echo fetches nothing.
    const deleted = variables.rows.filter((row) => !rejectedSet.has(row.id));
    cacheRemove(keys.list.org(variables.organizationId), deleted);
    removeDetailQueriesById(
      queryClient,
      keys.detail.base,
      deleted.map(({ id }) => id),
    );
    if (rejectedIds.length === 0) return;
    const rejectedLabels = variables.rows.filter((row) => rejectedSet.has(row.id));
    insertEntitiesIntoHome(queryClient, rejectedLabels);
    toaster.info(i18n.t('c:resources_delete_denied', { count: rejectedIds.length, total: variables.rows.length }));
    invalidateEmbeddingHosts('label', variables.organizationId);
  },
  onSettled: (data, error, variables) => {
    // A row put back is as the delete held it: remote changes were kept from the cache while it was pending.
    if (error || data?.rejectedIds?.length) invalidateOrgLists(queryClient, variables.organizationId);
  },
});

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

export const useLabelUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(labelUpdateOptions(queryClient));

  const prepare = ({ id, ops: rawOps }: UpdateLabelVars): PreparedVars<UpdateLabelFullVars> => {
    // Lowercased here as well as on the server, so the optimistic rows (and task embeds) never show the typed casing
    const ops = rawOps.name ? { ...rawOps, name: labelName(rawOps.name, findLabelInCache(id)?.mode) } : rawOps;
    // Folding into a queued create issues no update, so the optimistic row is patched here (onMutate does not run)
    if (squashIntoPendingCreate(queryClient, keys.create, id, ops, labelCreateKeys)) {
      const cached = findLabelInCache(id);
      if (cached) patchCachedLabel(queryClient, organizationId, cached, ops);
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

  const prepare = (labels: Label[]): PreparedVars<DeleteLabelVars> =>
    prepareProductDelete(queryClient, keys, keys.list.org(organizationId), labels, (rows) => ({
      tenantId,
      organizationId,
      rows,
      stx: createStxForDelete(),
    }));

  return { ...mutation, ...buildPreparedHandlers(mutation, prepare) };
};

// Mutation defaults (offline persistence): set when the module loads, before the cache restore hydrates a queued mutation.
queryClient.setQueryDefaults(keys.detail.base, {
  queryFn: ({ queryKey }) => {
    const id = queryKey[2] as string;
    const cached = findLabelInCache(id);
    const { organizationId, tenantId } = resolveQueryOrgTenantIds(cached, 'label');
    return getLabel({ path: { id, organizationId, tenantId } });
  },
});

queryClient.setMutationDefaults(keys.create, labelCreateOptions(queryClient));
queryClient.setMutationDefaults(keys.update, labelUpdateOptions(queryClient));
queryClient.setMutationDefaults(keys.delete, labelDeleteOptions(queryClient));
