import { EllipsisVerticalIcon, LinkIcon, TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import { DropdownActionItem } from '~/modules/common/dropdowner/dropdown-action-item';
import { DropdownerTriggerIcon } from '~/modules/common/dropdowner/trigger-icon';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { NamedText } from '~/modules/common/named-text';
import { openPopConfirm } from '~/modules/common/popconfirm';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { DeleteLabels } from '~/modules/label/delete-labels';
import { useLabelTileStore } from '~/modules/label/label-tile-store';
import { findLabelInCache } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';
import { Button } from '~/modules/ui/button';

/** Ellipsis button on an expanded label tile: copy its link and, for members, delete it. */
export function LabelOptionsButton({ row, canManage }: { row: LabelRow; canManage: boolean }) {
  const { t } = useTranslation();
  const { copyToClipboard } = useCopyToClipboard(2000);
  const isMobile = useBreakpointBelow('sm');

  // Epics keep per-row identity across projects; a secondary tag is one logical label over its slug group
  const deleteIds = row.mode === 'epic' ? [row.id] : row.siblingIds;

  const openOptionsDropdown = (currentTarget: HTMLButtonElement) => {
    const triggerRef = { current: currentTarget };

    const handleDeleteClick = () => {
      const { remove } = useDropdowner.getState();
      const labels = deleteIds.map((id) => findLabelInCache(id)).filter((label): label is Label => !!label);
      openPopConfirm(
        <NamedText i18nKey="c:delete_confirm.text" name={row.name} />,
        <DeleteLabels
          labels={labels.length ? labels : [row]}
          callback={() => {
            remove();
            useLabelTileStore.getState().collapse(row.id);
          }}
          onCancel={remove}
        />,
      );
    };

    useDropdowner.getState().create(
      <>
        <DropdownActionItem
          isMobile={isMobile}
          icon={LinkIcon}
          closeOnSelect={false}
          onSelect={async () => {
            const link = `${window.location.origin}${window.location.pathname}?labelPageId=${row.id}`;
            if (await copyToClipboard(link)) useDropdowner.getState().complete(t('c:copied'));
          }}
        >
          {t('c:copy_as_link')}
        </DropdownActionItem>
        {canManage && (
          <DropdownActionItem isMobile={isMobile} icon={TrashIcon} variant="destructive" onSelect={handleDeleteClick} closeOnSelect={false}>
            {t('c:delete')}
          </DropdownActionItem>
        )}
      </>,
      {
        id: `label-options-${row.id}`,
        triggerId: `label-options-btn-${row.id}`,
        triggerRef,
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
        className="relative z-10 h-8 w-8 data-dropdowner-active:bg-accent/50"
      >
        <DropdownerTriggerIcon icon={EllipsisVerticalIcon} className="size-3.5" />
      </Button>
    </TooltipButton>
  );
}
