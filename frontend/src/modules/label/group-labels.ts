import type { Label } from 'sdk';
import { combineRanks, compareLabelHeat } from '~/modules/label/label-order';
import type { LabelRow } from '~/modules/label/types';
import type { LabelUsage } from '~/modules/label/use-label-usage';

/**
 * One row per slug across projects (usage summed, heat added, sibling ids collected): the slug survives renames, the name does not.
 * `preferredProjectId` picks the sibling that represents a group.
 */
export const groupLabelRows = (labels: Label[], opts: { preferredProjectId?: string; usage?: LabelUsage } = {}): LabelRow[] => {
  const rowMap = new Map<string, LabelRow>();

  for (const label of labels) {
    const groupKey = label.slug;
    const existing = rowMap.get(groupKey);
    const usedCount = opts.usage?.[label.id] ?? 0;

    if (!existing) {
      rowMap.set(groupKey, {
        ...label,
        usedCount,
        projectUsage: { [label.projectId]: usedCount },
        siblingIds: [label.id],
        projectIds: [label.projectId],
      });
      continue;
    }

    const aggregates = {
      usedCount: existing.usedCount + usedCount,
      displayOrder: combineRanks(existing.displayOrder, label.displayOrder),
      projectUsage: { ...existing.projectUsage, [label.projectId]: (existing.projectUsage[label.projectId] ?? 0) + usedCount },
      siblingIds: [...existing.siblingIds, label.id],
      projectIds: existing.projectIds.includes(label.projectId) ? existing.projectIds : [...existing.projectIds, label.projectId],
    };
    const preferNew = !!opts.preferredProjectId && label.projectId === opts.preferredProjectId && existing.projectId !== opts.preferredProjectId;
    rowMap.set(groupKey, preferNew ? { ...label, ...aggregates } : { ...existing, ...aggregates });
  }

  return Array.from(rowMap.values());
};

/** Picker view over the grouped rows, hottest first. */
export const deduplicateLabels = (labels: Label[], preferredProjectId: string, usage?: LabelUsage): LabelRow[] =>
  groupLabelRows(labels, { preferredProjectId, usage }).sort(compareLabelHeat);
