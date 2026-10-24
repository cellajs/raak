import { EllipsisVerticalIcon, LinkIcon, TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { DropdownActionItem, DropdownActionSeparator } from '~/modules/common/dropdowner/dropdown-action-item';
import { DropdownerTriggerIcon } from '~/modules/common/dropdowner/trigger-icon';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { DeleteQuestion } from '~/modules/common/popconfirm';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { DeleteLabels } from '~/modules/label/delete-labels';
import { labelTileStore } from '~/modules/label/label-tile-store';
import { findLabelInCache } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';
import { Button } from '~/modules/ui/button';

interface LabelOptionsButtonProps {
  row: LabelRow;
  canManage: boolean;
}

/** Ellipsis button on an expanded label tile: copy its link and, for members, delete it. */
export function LabelOptionsButton({ row, canManage }: LabelOptionsButtonProps) {
  const { t } = useTranslation();
  const { copyToClipboard } = useCopyToClipboard(2000);

  // Epics keep per-row identity across projects; a secondary tag is one logical label over its slug group
  const deleteIds = row.mode === 'epic' ? [row.id] : row.siblingIds;

  const handleCopyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?labelPageId=${row.id}`;
    if (await copyToClipboard(link)) dropdowner.getState().complete(t('c:copied'));
  };

  const collapseOnDelete = ({ status }: CallbackArgs<Label[]>) => {
    if (status === 'success') labelTileStore.getState().collapse(row.id);
  };

  const openOptionsDropdown = (currentTarget: HTMLButtonElement) => {
    const labels = deleteIds.map((id) => findLabelInCache(id)).filter((label): label is Label => !!label);
    dropdowner.getState().create(
      <>
        <DropdownActionItem icon={LinkIcon} closeOnSelect={false} onSelect={handleCopyLink}>
          {t('c:copy_as_link')}
        </DropdownActionItem>
        {canManage && (
          <>
            <DropdownActionSeparator />
            <DropdownActionItem
              icon={TrashIcon}
              variant="destructive"
              confirm={{
                title: <DeleteQuestion resource="c:label" name={row.name} />,
                content: <DeleteLabels labels={labels.length ? labels : [row]} callback={collapseOnDelete} />,
              }}
            >
              {t('c:delete')}
            </DropdownActionItem>
          </>
        )}
      </>,
      {
        id: `label-options-${row.id}`,
        triggerId: `label-options-btn-${row.id}`,
        triggerRef: { current: currentTarget },
        align: 'end',
        kind: 'menu',
        popupClassName: 'min-w-48',
      },
    );
  };

  return (
    <TooltipButton toolTipContent={t('c:options')} side="top" sideOffset={5}>
      <Button
        onClick={({ currentTarget }) => openOptionsDropdown(currentTarget)}
        aria-label={t('c:resource_options', { resource: t('c:label') })}
        variant="ghost"
        size="xs"
        className="size-8 data-dropdowner-active:bg-accent/50"
      >
        <DropdownerTriggerIcon icon={EllipsisVerticalIcon} className="size-3.5" />
      </Button>
    </TooltipButton>
  );
}
