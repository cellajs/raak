import { TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { NamedText } from '~/modules/common/named-text';
import { SelectionActionBar } from '~/modules/common/selection-action-bar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { DeleteLabels } from '~/modules/label/delete-labels';
import { findLabelGroup } from '~/modules/label/group-labels';
import { type Label, labelQueryKeys } from '~/modules/label/query';
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
}

/** Floating action bar for label rows selected in the labels panel: delete + clear. */
export function LabelSelectedButtons({ selectedLabelIds, clearSelection }: LabelSelectedButtonsProps) {
  const { t } = useTranslation();

  const resourceOf = (count: number) => (count > 1 ? t('c:label_other') : t('c:label')).toLowerCase();

  const openDeleteDialog = (currentTarget: HTMLButtonElement) => {
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
    if (!toDelete.length) return;

    const { create, remove } = useDialoger.getState();
    const removeDialog = () => remove('delete-labels');
    const onDeleted = () => {
      removeDialog();
      clearSelection();
    };

    // The count is of selected rows, not of the same-slug labels a row deletes with it
    const count = selectedLabelIds.length;
    create(<DeleteLabels labels={toDelete} callback={onDeleted} onCancel={removeDialog} />, {
      id: 'delete-labels',
      triggerRef: { current: currentTarget },
      className: 'max-w-xl',
      title: t('c:delete_resource', { resource: resourceOf(count) }),
      description: <NamedText i18nKey="c:confirm.delete_counted_resource" values={{ count, resource: resourceOf(count) }} />,
    });
  };

  return (
    <SelectionActionBar count={selectedLabelIds.length} onClear={clearSelection}>
      <TooltipButton toolTipContent={t('c:delete_resource', { resource: resourceOf(selectedLabelIds.length) })} side="top">
        <Button variant="destructive" onClick={({ currentTarget }) => openDeleteDialog(currentTarget)}>
          <TrashIcon />
          <span>{t('c:delete')}</span>
        </Button>
      </TooltipButton>
    </SelectionActionBar>
  );
}
