import type { Label } from 'sdk';
import { foldText } from 'shared/utils/text-match';
import { labelRecencyStore } from '~/modules/label/label-recency-store';
import type { LabelRow } from '~/modules/label/types';
import type { LabelUsage } from '~/modules/label/use-label-usage';

/**
 * One row per slug across projects (usage summed, sibling ids collected): the slug survives renames, the name does not.
 * `preferredProjectId` picks the sibling that represents a group.
 */
export const groupLabelRows = (labels: Label[], opts: { preferredProjectId?: string; usage?: LabelUsage } = {}): LabelRow[] => {
  const rowMap = new Map<string, Omit<LabelRow, 'nameFolded' | 'keywordsFolded'>>();

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
      projectUsage: { ...existing.projectUsage, [label.projectId]: (existing.projectUsage[label.projectId] ?? 0) + usedCount },
      siblingIds: [...existing.siblingIds, label.id],
      projectIds: existing.projectIds.includes(label.projectId) ? existing.projectIds : [...existing.projectIds, label.projectId],
    };
    const preferNew = !!opts.preferredProjectId && label.projectId === opts.preferredProjectId && existing.projectId !== opts.preferredProjectId;
    rowMap.set(groupKey, preferNew ? { ...label, ...aggregates } : { ...existing, ...aggregates });
  }

  return Array.from(rowMap.values(), (row) => ({ ...row, nameFolded: foldText(row.name), keywordsFolded: foldText(row.keywords) }));
};

export const findLabelGroup = (labels: Label[], labelId: string): LabelRow | undefined =>
  groupLabelRows(labels).find((row) => row.siblingIds.includes(labelId));

/** Picker view over the grouped rows, sorted by recency then name. */
export const deduplicateLabels = (labels: Label[], preferredProjectId: string, organizationId?: string, usage?: LabelUsage): LabelRow[] => {
  const rows = groupLabelRows(labels, { preferredProjectId, usage });
  const { getScore } = labelRecencyStore.getState();

  return rows.sort(
    (a, b) => (organizationId ? getScore(organizationId, b.slug) - getScore(organizationId, a.slug) : 0) || a.name.localeCompare(b.name),
  );
};
