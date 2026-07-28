import { labelRecencyStore } from '~/modules/label/label-recency-store';
import type { Label } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';

/**
 * Group labels into visible rows by slug: rows sharing a slug across projects collapse into one
 * (aggregating usedCount and collecting sibling ids), so a workspace shows a single row per label.
 * Slug is the stable cross-project identity; it survives renames, where the display name does not.
 * The single source of the display grouping rule; the panel table, label page and picker all derive
 * from it. Operations keep their own identity: rename/delete on epics act per row (id), so merged
 * display never cascades a mutation across another project's epic. `preferredProjectId` picks which
 * sibling represents a group (e.g. the current project's copy).
 */
export const groupLabelRows = (labels: Label[], opts: { preferredProjectId?: string } = {}): LabelRow[] => {
  const rowMap = new Map<string, Omit<LabelRow, 'nameLower' | 'keywordsLower'>>();

  for (const label of labels) {
    const groupKey = label.slug;
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

  return Array.from(rowMap.values(), (row) => ({
    ...row,
    nameLower: row.name.toLowerCase(),
    keywordsLower: row.keywords.toLowerCase(),
  }));
};

/** The group row containing a given label id, if any (matched through its slug siblings). */
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
      const diff = getScore(organizationId, b.slug) - getScore(organizationId, a.slug);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
};
