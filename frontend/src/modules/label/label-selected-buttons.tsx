import { TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SelectionActionBar } from '~/modules/common/selection-action-bar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { findLabelGroup } from '~/modules/label/group-labels';
import { type Label, labelQueryKeys, useLabelDeleteMutation } from '~/modules/label/query';
import { Button } from '~/modules/ui/button';
import { getQueryItems, getSimilarQueries } from '~/query/basic/mutate-query';

/** All labels currently present in list query caches, deduped by id. */
const cachedLabels = (): Label[] => {
  const queries = getSimilarQueries<Label>(labelQueryKeys.list.base);
  const labels = queries.flatMap(([, data]) => (data ? getQueryItems(data) : []));
  return [...new Map(labels.map((label) => [label.id, label])).values()];
};

interface LabelSelectedButtonsProps {
  selectedLabelIds: string[];
  clearSelection: () => void;
  organizationId: string;
  tenantId: string;
}

/** Floating action bar for label rows selected in the labels panel: remove + clear. */
export function LabelSelectedButtons({
  selectedLabelIds,
  clearSelection,
  organizationId,
  tenantId,
}: LabelSelectedButtonsProps) {
  const { t } = useTranslation();
  const deleteLabels = useLabelDeleteMutation(tenantId, organizationId);

  const onRemove = async () => {
    // A secondary row aggregates same-slug labels across projects; removing it removes the whole
    // group. Epics keep per-row identity even when their slug-group shows as one row, so removing
    // one deletes only the selected epic, not its same-slug siblings in other projects.
    // Groups are re-derived from the cache at action time so stale selection snapshots can't leak in.
    const labels = cachedLabels();
    const byId = new Map(labels.map((label) => [label.id, label]));
    const toDelete = selectedLabelIds.flatMap((selectedId) => {
      const row = findLabelGroup(labels, selectedId);
      if (!row) return [];
      if (row.mode === 'epic') {
        const selected = byId.get(selectedId);
        return selected ? [selected] : [];
      }
      return row.siblingIds.flatMap((id) => byId.get(id) ?? []);
    });
    await deleteLabels.mutateAsync(toDelete);
    clearSelection();
  };

  return (
    <SelectionActionBar count={selectedLabelIds.length} onClear={clearSelection}>
      <TooltipButton toolTipContent={t('c:remove_label')} side="top">
        <Button variant="destructive" onClick={onRemove}>
          <TrashIcon />
          <span className="ml-1">{t('c:remove')}</span>
        </Button>
      </TooltipButton>
    </SelectionActionBar>
  );
}
