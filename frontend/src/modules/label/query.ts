import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
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
  type UpdateLabelData,
  updateLabel,
} from 'sdk';
import { zLabel } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import {
  baseInfiniteQueryOptions,
  createCacheFinder,
  createEntityKeys,
  createOptimisticEntity,
  fetchAllBySeq,
  invalidateIfLastMutation,
  registerEntityQueryKeys,
  removePendingMutations,
  SYNC_CHUNK_SIZE,
} from '~/query/basic';
import { cacheCreate, cacheRemove, cacheUpdate } from '~/query/basic/cache-mutations';
import { syncStaleTime } from '~/query/basic/sync-stale-config';
import { addMutationRegistrar } from '~/query/mutation-registry';
import {
  coalescePendingCreate,
  createStxForCreate,
  createStxForDelete,
  createStxForUpdate,
  mergeServerResponse,
  squashPendingMutation,
  syncEntityToCache,
} from '~/query/offline';
import { getCacheToken } from '~/query/realtime';
import { getRouteOrgId, getRouteTenantId } from '~/query/realtime/sync-priority';
import type { QueryOrgContext } from '~/query/types';
import { createResourceError } from '~/utils/resource-error';

export type { Label } from 'sdk';

type LabelCreateInput = Omit<CreateLabelsData['body'][number], 'stx'>;
type UpdateLabelBody = NonNullable<UpdateLabelData['body']>;
type UpdateLabelFields = UpdateLabelBody['ops'];
type UpdateLabelVars = { id: string; ops: UpdateLabelFields };

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
// Delta fetch: one seq-keyset chunk; cache-ops pages through chunks (see fetchRangeAndPatch)
registerEntityQueryKeys('label', keys, (organizationId, tenantId, seqCursor, options) => {
  return getLabels({
    path: { tenantId: tenantId!, organizationId: organizationId! },
    query: { seqCursor, includeDeleted: 'true', limit: String(SYNC_CHUNK_SIZE) },
    headers: options?.cacheToken ? { 'x-cache-token': options.cacheToken } : undefined,
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
      const cacheToken = getCacheToken('label', id);
      return getLabel({
        path: { id, organizationId, tenantId },
        headers: cacheToken ? { 'X-Cache-Token': cacheToken } : undefined,
      });
    },
    initialData: () => findLabelInCache(id),
  });

type LabelsListParams = Omit<NonNullable<GetLabelsData['query']>, 'limit' | 'offset'> &
  GetLabelsData['path'] & { limit?: number };

/**
 * Canonical label query — one flat query per organization scope.
 * Fetches all labels for the org, stored at keys.list.org(organizationId).
 * Consumers derive views via select() for workspace/project filtering.
 * Sync (SSE + delta fetch) keeps this fresh; staleTime follows sync liveness.
 */
export const labelsCanonicalOptions = ({ organizationId, tenantId }: { organizationId: string; tenantId: string }) => {
  return queryOptions({
    queryKey: keys.list.org(organizationId),
    queryFn: async () => {
      // Seq-keyset hydration (see fetchAllBySeq): complete, immune to offset drift.
      // No cursor baseline write — label seq counters are per project, this read is org-wide.
      const { items, total } = await fetchAllBySeq(({ seqCursor, limit }) =>
        getLabels({
          path: { organizationId, tenantId },
          query: { seqCursor, limit },
        }),
      );
      return { items, total };
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

// --- Mutations ---

export const useLabelCreateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const orgKey = keys.list.org(organizationId);

  return useMutation({
    mutationKey: keys.create,
    scope: { id: 'label' },
    mutationFn: async (data: LabelCreateInput) => {
      const stx = createStxForCreate();
      const result = await createLabels({ body: [{ ...data, stx }], path: { organizationId, tenantId } });
      return result.data[0];
    },
    onMutate: async (newLabelData) => {
      await queryClient.cancelQueries({ queryKey: orgKey });
      const optimisticLabel = createOptimisticEntity(zLabel, newLabelData);
      cacheCreate(orgKey, [optimisticLabel]);
      return { optimisticLabel };
    },
    meta: { suppressGlobalErrorToast: true },
    onError: (_err, _newLabel, context) => {
      handleError('create');
      if (context?.optimisticLabel) cacheRemove(orgKey, [context.optimisticLabel]);
    },
    onSuccess: (createdLabel, _variables, context) => {
      if (context?.optimisticLabel) cacheRemove(orgKey, [context.optimisticLabel]);
      // Upsert guard: avoid duplicates from concurrent race
      if (findLabelInCache(createdLabel.id)) cacheUpdate(orgKey, [createdLabel]);
      else cacheCreate(orgKey, [createdLabel]);
    },
    onSettled: (_data, error) => {
      if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, orgKey);
    },
  });
};

export const useLabelUpdateMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const orgKey = keys.list.org(organizationId);

  return useMutation({
    mutationKey: keys.update,
    mutationFn: async ({ id, ops }: UpdateLabelVars) => {
      const scalarFieldNames = ops ? Object.keys(ops) : [];
      const stx = createStxForUpdate(scalarFieldNames);
      return updateLabel({ body: { ops, stx }, path: { id, organizationId, tenantId } });
    },
    onMutate: async ({ id, ops }: UpdateLabelVars) => {
      // If there's a pending create for this entity, fold update ops into it
      if (coalescePendingCreate(queryClient, keys.create, id, ops as Record<string, unknown>)) {
        return { coalesced: true };
      }

      const mergedOps = squashPendingMutation(queryClient, keys.update, id, ops as Record<string, unknown>);
      await queryClient.cancelQueries({ queryKey: orgKey });
      await queryClient.cancelQueries({ queryKey: keys.detail.byId(id) });
      const previousLabel = findLabelInCache(id);
      if (previousLabel) {
        const optimisticLabel = { ...previousLabel, ...mergedOps, updatedAt: new Date().toISOString() };
        cacheUpdate(orgKey, [optimisticLabel]);
        queryClient.setQueryData(keys.detail.byId(id), optimisticLabel);
      }
      return { previousLabel };
    },
    meta: { suppressGlobalErrorToast: true },
    onError: (_err, _variables, context) => {
      handleError('update');
      if (context?.previousLabel) {
        cacheUpdate(orgKey, [context.previousLabel]);
        queryClient.setQueryData(keys.detail.byId(context.previousLabel.id), context.previousLabel);
      }
    },
    onSuccess: (updatedLabel, variables) => {
      const cached = findLabelInCache(updatedLabel.id);
      const mutatedKeys = variables.ops ? Object.keys(variables.ops) : [];
      const merged = mergeServerResponse({ cached, serverEntity: updatedLabel, mutatedKeys });
      syncEntityToCache({ entity: merged, listKey: orgKey, detailKey: keys.detail.byId(updatedLabel.id), queryClient });
    },
    onSettled: (_data, error) => {
      if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, orgKey);
    },
  });
};

export const useLabelDeleteMutation = (tenantId: string, organizationId: string) => {
  const queryClient = useQueryClient();
  const orgKey = keys.list.org(organizationId);

  return useMutation({
    mutationKey: keys.delete,
    scope: { id: 'label' },
    mutationFn: async (labels: Label[]) => {
      const ids = labels.map(({ id }) => id);
      const stx = createStxForDelete();
      await deleteLabels({ body: { ids, stx }, path: { organizationId, tenantId } });
    },
    onMutate: async (labelsToDelete) => {
      removePendingMutations(
        queryClient,
        keys.update,
        labelsToDelete.map((l) => l.id),
      );
      await queryClient.cancelQueries({ queryKey: orgKey });
      cacheRemove(orgKey, labelsToDelete);
      for (const { id } of labelsToDelete) {
        queryClient.removeQueries({ queryKey: keys.detail.byId(id) });
      }
      return { deletedLabels: labelsToDelete };
    },
    meta: { suppressGlobalErrorToast: true },
    onError: (_err, _labels, context) => {
      handleError('delete');
      if (context?.deletedLabels) cacheCreate(orgKey, context.deletedLabels);
    },
    onSettled: (_data, error) => {
      if (error) invalidateIfLastMutation(queryClient, labelsMutationKeyBase, orgKey);
    },
  });
};

// --- Mutation defaults (offline persistence) ---

addMutationRegistrar((queryClient: QueryClient) => {
  queryClient.setQueryDefaults(keys.detail.base, {
    queryFn: ({ queryKey, meta }) => {
      const id = queryKey[2] as string;
      const cacheToken = getCacheToken('label', id);
      const cached = findLabelInCache(id);
      const organizationId = (meta?.organizationId as string) ?? cached?.organizationId ?? getRouteOrgId();
      const tenantId = (meta?.tenantId as string) ?? cached?.tenantId ?? getRouteTenantId();
      if (!organizationId || !tenantId) throw new Error('Cannot resolve organizationId/tenantId for label fetch');
      return getLabel({
        path: { id, organizationId, tenantId },
        headers: cacheToken ? { 'X-Cache-Token': cacheToken } : undefined,
      });
    },
  });

  queryClient.setMutationDefaults(keys.create, {
    mutationFn: async ({ tenantId, organizationId, data }: QueryOrgContext & { data: LabelCreateInput }) => {
      const stx = createStxForCreate();
      const result = await createLabels({ body: [{ ...data, stx }], path: { organizationId, tenantId } });
      return result.data[0];
    },
  });

  queryClient.setMutationDefaults(keys.update, {
    mutationFn: async ({ tenantId, organizationId, id, ops }: QueryOrgContext & UpdateLabelVars) => {
      const scalarFieldNames = ops ? Object.keys(ops) : [];
      const stx = createStxForUpdate(scalarFieldNames);
      return updateLabel({ body: { ops, stx }, path: { id, organizationId, tenantId } });
    },
  });

  queryClient.setMutationDefaults(keys.delete, {
    mutationFn: async ({ tenantId, organizationId, labels }: QueryOrgContext & { labels: Label[] }) => {
      const ids = labels.map((l) => l.id);
      const stx = createStxForDelete();
      await deleteLabels({ path: { organizationId, tenantId }, body: { ids, stx } });
    },
  });
});
