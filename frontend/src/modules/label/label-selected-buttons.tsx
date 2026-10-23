import { TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { NamedText } from '~/modules/common/named-text';
import { SelectionActionBar } from '~/modules/common/selection-action-bar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { DeleteLabels } from '~/modules/label/delete-labels';
import { findLabelGroup } from '~/modules/label/group-labels';
import { labelQueryKeys } from '~/modules/label/query';
import { Button } from '~/modules/ui/button';
import { getQueryItems, getSimilarQueries } from '~/query/basic/mutate-query';

const cachedLabels = () => {
  const queries = getSimilarQueries<Label>(labelQueryKeys.list.base);
  const labels = queries.flatMap(([, data]) => (data ? getQueryItems(data) : []));
  return new Map(labels.map((label) => [label.id, label]));
};

interface LabelSelectedButtonsProps {
  selectedLabelIds: string[];
  clearSelection: () => void;
}

/** Floating action bar for the label rows selected in the labels panel. */
export function LabelSelectedButtons({ selectedLabelIds, clearSelection }: LabelSelectedButtonsProps) {
  const { t } = useTranslation();

  // The count is of selected rows, not of the same-slug labels a row deletes with it
  const count = selectedLabelIds.length;
  const resource = t('c:label', { count }).toLowerCase();

  const openDeleteDialog = (currentTarget: HTMLButtonElement) => {
    // A secondary row deletes its whole slug group, an epic only its own row. Groups are re-derived from the
    // cache at action time, so a stale selection cannot leak in.
    const byId = cachedLabels();
    const labels = [...byId.values()];
    const toDelete = selectedLabelIds.flatMap((selectedId) => {
      const row = findLabelGroup(labels, selectedId);
      if (!row) return [];
      if (row.mode === 'epic') {
        const selected = byId.get(selectedId);
        return selected ? [selected] : [];
      }
      return row.siblingIds.flatMap((id) => byId.get(id) ?? []);
    });
    if (!toDelete.length) return;

    const { create, remove } = dialoger.getState();
    create(<DeleteLabels dialog labels={toDelete} callback={clearSelection} onCancel={() => remove('delete-labels')} />, {
      id: 'delete-labels',
      triggerRef: { current: currentTarget },
      className: 'max-w-xl',
      title: t('c:delete_resource', { resource }),
      description: <NamedText i18nKey="c:confirm.delete_counted_resource" values={{ count, resource }} />,
    });
  };

  return (
    <SelectionActionBar count={count} onClear={clearSelection}>
      <TooltipButton toolTipContent={t('c:delete_resource', { resource })} side="top">
        <Button variant="destructive" onClick={({ currentTarget }) => openDeleteDialog(currentTarget)}>
          <TrashIcon />
          <span>{t('c:delete')}</span>
        </Button>
      </TooltipButton>
    </SelectionActionBar>
  );
}
