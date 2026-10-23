import type { Label } from 'sdk';
import { foldText } from 'shared/utils/text-match';
import { labelRecencyStore } from '~/modules/label/label-recency-store';
import type { LabelRow } from '~/modules/label/types';
import type { LabelUsage } from '~/modules/label/use-label-usage';

/**
 * Group labels into visible rows by slug: rows sharing a slug across projects collapse into one
 * (summing their usage and collecting sibling ids), so a workspace shows a single row per label.
 * Slug is the stable cross-project identity; it survives renames, where the display name does not.
 * The single source of the display grouping rule; the panel list, label tiles and picker all derive
 * from it. Operations keep their own identity: rename/delete on epics act per row (id), so merged
 * display never cascades a mutation across another project's epic. `preferredProjectId` picks which
 * sibling represents a group (e.g. the current project's copy).
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

/** The group row containing a given label id, if any (matched through its slug siblings). */
export const findLabelGroup = (labels: Label[], labelId: string): LabelRow | undefined =>
  groupLabelRows(labels).find((row) => row.siblingIds.includes(labelId));

/**
 * Picker view over the grouped rows: one representative per name (preferring the current
 * project's copy), sorted by recency then name.
 */
export const deduplicateLabels = (labels: Label[], preferredProjectId: string, organizationId?: string, usage?: LabelUsage): LabelRow[] => {
  const rows = groupLabelRows(labels, { preferredProjectId, usage });
  const getScore = organizationId ? labelRecencyStore.getState().getScore : undefined;

  return rows.sort((a, b) => {
    if (getScore && organizationId) {
      const diff = getScore(organizationId, b.slug) - getScore(organizationId, a.slug);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
};
