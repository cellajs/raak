import type { Label } from 'sdk';
import { useDescriptionUpdate } from '~/modules/common/blocknote/use-description-update';
import { useLabelUpdateMutation } from '~/modules/label/query';

/**
 * Returns the epic-description update policy.
 * Collaborative edits patch caches while Yjs persists; with Yjs off, edits use the update mutation.
 */
export const useLabelDescriptionUpdate = (label: Label) => {
  const { mutateAsync: updateLabel } = useLabelUpdateMutation(label.tenantId, label.organizationId);
  return useDescriptionUpdate('label', label, (ops) => updateLabel({ id: label.id, ops }));
};
