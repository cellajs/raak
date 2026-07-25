import { labelRecencyStore } from '~/modules/label/label-recency-store';
import type { Label } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';

/**
 * Group labels into visible rows: secondary tags group by name across projects (aggregating
 * usedCount and collecting sibling ids), epics stay concrete per-project rows. The single
 * source of the grouping rule; the panel table, label page and picker all derive from it.
 * `preferredProjectId` picks which sibling represents a group (e.g. the current project's copy).
 */
export const groupLabelRows = (labels: Label[], opts: { preferredProjectId?: string } = {}): LabelRow[] => {
  const rowMap = new Map<string, LabelRow>();

  for (const label of labels) {
    const groupKey = label.mode === 'epic' ? label.id : label.name;
    const existing = rowMap.get(groupKey);

    if (!existing) {
      rowMap.set(groupKey, { ...label, siblingIds: [label.id], projectIds: [label.projectId] });
      continue;
    }

    const aggregates = {
      usedCount: (existing.usedCount ?? 0) + (label.usedCount ?? 0),
      siblingIds: [...existing.siblingIds, label.id],
      projectIds: existing.projectIds.includes(label.projectId)
        ? existing.projectIds
        : [...existing.projectIds, label.projectId],
    };
    const preferNew =
      !!opts.preferredProjectId &&
      label.projectId === opts.preferredProjectId &&
      existing.projectId !== opts.preferredProjectId;
    rowMap.set(groupKey, preferNew ? { ...label, ...aggregates } : { ...existing, ...aggregates });
  }

  return Array.from(rowMap.values());
};

/** The group row containing a given label id, if any (epics are their own group). */
export const findLabelGroup = (labels: Label[], labelId: string): LabelRow | undefined =>
  groupLabelRows(labels).find((row) => row.siblingIds.includes(labelId));

/**
 * Picker view over the grouped rows: one representative per name (preferring the current
 * project's copy), sorted by recency then name.
 */
export const deduplicateLabels = (labels: Label[], preferredProjectId: string, organizationId?: string): Label[] => {
  const rows = groupLabelRows(labels, { preferredProjectId });
  const getScore = organizationId ? labelRecencyStore.getState().getScore : undefined;

  return rows.sort((a, b) => {
    if (getScore && organizationId) {
      const diff = getScore(organizationId, b.name) - getScore(organizationId, a.name);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
};
