import type { Label } from 'sdk';
import { createDescriptionUpdater } from '~/modules/common/blocknote/description-updater';
import { useLabelUpdateMutation } from '~/modules/label/query';

/**
 * Returns the epic-description update policy.
 * Collaborative edits patch caches while Yjs persists; with Yjs off, edits use the update mutation.
 */
export const useLabelDescriptionUpdate = (label: Label) => {
  const { mutateAsync: updateLabel } = useLabelUpdateMutation(label.tenantId, label.organizationId);
  return createDescriptionUpdater('label', label, (ops) => updateLabel({ id: label.id, ops }));
};
