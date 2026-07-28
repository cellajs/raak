import type { Label } from 'sdk';
import { patchDescriptionCaches } from '~/modules/common/blocknote/description-cache';
import { labelQueryKeys, useLabelUpdateMutation } from '~/modules/label/query';
import { findInCache } from '~/query/basic/find-in-list-cache';

/**
 * Returns the epic-description update policy.
 * Collaborative edits patch caches while Yjs persists; other edits use the update mutation.
 */
export const useLabelDescriptionUpdate = (label: Label) => {
  const { mutateAsync: updateLabel } = useLabelUpdateMutation(label.tenantId, label.organizationId);

  return async (description: string, collaborative: boolean) => {
    if (collaborative) {
      patchDescriptionCaches(
        'label',
        label.id,
        { detailKey: labelQueryKeys.detail.byId(label.id), listKey: labelQueryKeys.list.org(label.organizationId) },
        { description, updatedAt: new Date().toISOString() },
      );
      return;
    }

    // Skip if the label was deleted (e.g. unmount flush after deletion)
    if (!findInCache<Label>('label', label.id)) return;
    await updateLabel({ id: label.id, ops: { description } });
  };
};
