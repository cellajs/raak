import type { Label } from 'sdk';
import { labelQueryKeys, useLabelUpdateMutation } from '~/modules/label/query';
import { cacheUpdate } from '~/query/basic/cache-mutations';
import { findInCache } from '~/query/basic/find-in-list-cache';
import type { ItemData } from '~/query/basic/types';
import { queryClient } from '~/query/query-client';

/**
 * Returns `updateData(description)` — the epic-description persistence policy, kept out of
 * the editor component. Mirrors the task variant:
 * - collaborative (Yjs): the relay owns backend persistence, so this only patches the caches
 *   optimistically; the relay's materialization arrives via SSE with authoritative values.
 * - non-collaborative: persists via the standard update mutation (offline queue, HLC).
 */
export const useLabelDescriptionUpdate = (label: Label, collaborative: boolean) => {
  const { mutateAsync: updateLabel } = useLabelUpdateMutation(label.tenantId, label.organizationId);
  const orgKey = labelQueryKeys.list.org(label.organizationId);

  return async (description: string) => {
    if (collaborative) {
      const patch = { description, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<Label>(labelQueryKeys.detail.byId(label.id), (old) =>
        old ? { ...old, ...patch } : undefined,
      );
      const cached = findInCache<Label>('label', label.id);
      if (cached) cacheUpdate(orgKey, [{ ...cached, ...patch } as ItemData]);
      return;
    }

    // Skip if the label was deleted (e.g. unmount flush after deletion)
    if (!findInCache<Label>('label', label.id)) return;
    await updateLabel({ id: label.id, ops: { description } });
  };
};
