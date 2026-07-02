import { labelRecencyStore } from '~/modules/label/label-recency-store';
import type { Label } from '~/modules/label/query';

export const deduplicateLabels = (labels: Label[], preferredProjectId: string, organizationId?: string): Label[] => {
  const labelMap = new Map<string, Label>();

  for (const label of labels) {
    const existing = labelMap.get(label.name);

    // First one with this name, store it
    if (!existing) labelMap.set(label.name, label);
    // Replace if current matches preferredProjectId and existing does not
    else if (label.projectId === preferredProjectId && existing.projectId !== preferredProjectId)
      labelMap.set(label.name, label);
  }

  const getScore = organizationId ? labelRecencyStore.getState().getScore : undefined;

  return Array.from(labelMap.values()).sort((a, b) => {
    if (getScore && organizationId) {
      const diff = getScore(organizationId, b.name) - getScore(organizationId, a.name);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
};
