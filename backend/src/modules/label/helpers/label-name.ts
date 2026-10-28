import { type LabelMode, labelName } from 'shared/config/labels-config';
import { AppError } from '#/core/error';

/**
 * The name a label stores: a slug for a tag or an epic, as typed for a primary label.
 * @throws AppError 400 `invalid_request` for a name that is empty once normalized.
 */
export const normalizeLabelName = (name: string, mode: LabelMode | undefined) => {
  const normalized = labelName(name, mode);
  if (!normalized) throw new AppError(400, 'invalid_request', 'warn', { entityType: 'label', meta: { reason: 'Label name is empty as a slug' } });
  return normalized;
};
