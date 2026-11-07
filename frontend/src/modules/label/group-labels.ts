import type { Label } from 'sdk';
import { combineRanks, compareLabelHeat } from '~/modules/label/label-order';
import type { LabelRow } from '~/modules/label/types';
import type { LabelUsage } from '~/modules/label/use-label-usage';

// An epic and a tag may share a slug across projects; each groups only with its own kind, so a project can leave an epic and keep the tag
const groupKeyOf = (label: Label) => `${label.mode === 'epic' ? 'epic' : 'tag'}:${label.slug}`;

// An epic group shows and edits one description: a row that has one wins, so an older tag joining the epic cannot take its place; else the oldest
export const representsEpic = (candidate: Label, current: Label) =>
  !!candidate.description === !!current.description ? candidate.createdAt < current.createdAt : !!candidate.description;

/**
 * One row per slug and kind across projects (usage summed, heat added, sibling ids collected): the slug survives renames, the name does not.
 * `preferredProjectId` picks the sibling that represents a tag group; an epic group is represented by the row holding its description.
 */
export const groupLabelRows = (labels: Label[], opts: { preferredProjectId?: string; usage?: LabelUsage } = {}): LabelRow[] => {
  const rowMap = new Map<string, LabelRow>();

  for (const label of labels) {
    const groupKey = groupKeyOf(label);
    const existing = rowMap.get(groupKey);
    const usedCount = opts.usage?.[label.id] ?? 0;

    if (!existing) {
      rowMap.set(groupKey, {
        ...label,
        usedCount,
        projectUsage: { [label.projectId]: usedCount },
        siblingIds: [label.id],
        projectIds: [label.projectId],
        groupKey,
      });
      continue;
    }

    const aggregates = {
      groupKey,
      usedCount: existing.usedCount + usedCount,
      displayOrder: combineRanks(existing.displayOrder, label.displayOrder),
      projectUsage: { ...existing.projectUsage, [label.projectId]: (existing.projectUsage[label.projectId] ?? 0) + usedCount },
      siblingIds: [...existing.siblingIds, label.id],
      projectIds: existing.projectIds.includes(label.projectId) ? existing.projectIds : [...existing.projectIds, label.projectId],
    };
    const preferNew =
      label.mode === 'epic'
        ? representsEpic(label, existing)
        : !!opts.preferredProjectId && label.projectId === opts.preferredProjectId && existing.projectId !== opts.preferredProjectId;
    rowMap.set(groupKey, preferNew ? { ...label, ...aggregates } : { ...existing, ...aggregates });
  }

  return Array.from(rowMap.values());
};

/** Picker view over the grouped rows, hottest first. */
export const deduplicateLabels = (labels: Label[], preferredProjectId: string, usage?: LabelUsage): LabelRow[] =>
  groupLabelRows(labels, { preferredProjectId, usage }).sort(compareLabelHeat);
