import { CopyIcon, EllipsisVerticalIcon, LinkIcon, Maximize2Icon, TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import { titleFromDocument } from 'shared/blocknote';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import { setCurrentItem } from '~/modules/board-focus/focus-item';
import { ConfirmText } from '~/modules/common/confirm-text';
import { DropdownActionItem } from '~/modules/common/dropdowner/dropdown-action-item';
import { DropdownerTriggerIcon } from '~/modules/common/dropdowner/trigger-icon';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { openPopConfirm } from '~/modules/common/popconfirm';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { DeleteTasks } from '~/modules/task/delete-tasks';
import { openTaskSheet } from '~/modules/task/helpers/board-navigation';
import { copyTasksToClipboard } from '~/modules/task/helpers/copy-tasks';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { truncateMiddle } from '~/utils/truncate-middle';

/** Ellipsis button that opens a task's options menu, on a collapsed card, an expanded card header and the sheet. */
export function TaskOptionsButton({ task, isSheet = false }: { task: Task; isSheet?: boolean }) {
  const { t } = useTranslation();
  const { copyToClipboard } = useCopyToClipboard(2000);

  const shareLink = `${appConfig.backendUrl}/t/${task.id}`;

  const openOptionsDropdown = (currentTarget: HTMLButtonElement) => {
    const { create } = useDropdowner.getState();
    const isMobile = window.innerWidth < 640;
    // Anchor the dropdown to the clicked element. The button carries no `id`, because a
    // caller-supplied `id` on a Base UI tooltip trigger makes the tooltip flash and close.
    const triggerRef = { current: currentTarget };

    const handleDeleteClick = () => {
      const { remove } = useDropdowner.getState();
      // `task.name` is empty for a task made in the app: its title is the text of its summary block
      const title = titleFromDocument(task.summary);
      openPopConfirm(
        title ? (
          <ConfirmText i18nKey="c:delete_confirm.text" values={{ name: truncateMiddle(title, 20) }} />
        ) : (
          <ConfirmText i18nKey="c:confirm.delete_counted_resource" values={{ count: 1, resource: t('c:task').toLowerCase() }} />
        ),
        <DeleteTasks tasks={[task]} callback={remove} onCancel={remove} />,
      );
    };

    create(
      <>
        {!isSheet && (
          <DropdownActionItem
            isMobile={isMobile}
            icon={Maximize2Icon}
            onSelect={() => {
              setCurrentItem(null);
              openTaskSheet(task.id);
              useDropdowner.getState().remove();
            }}
          >
            {t('c:expand')}
          </DropdownActionItem>
        )}
        <DropdownActionItem
          isMobile={isMobile}
          icon={CopyIcon}
          closeOnSelect={false}
          onSelect={async () => {
            if (await copyTasksToClipboard([task])) useDropdowner.getState().complete(t('c:copied'));
          }}
        >
          {t('c:copy_content')}
        </DropdownActionItem>
        <DropdownActionItem
          isMobile={isMobile}
          icon={LinkIcon}
          closeOnSelect={false}
          onSelect={async () => {
            if (await copyToClipboard(shareLink)) useDropdowner.getState().complete(t('c:copied'));
          }}
        >
          {t('c:copy_as_link')}
        </DropdownActionItem>
        <DropdownActionItem isMobile={isMobile} icon={TrashIcon} variant="destructive" onSelect={handleDeleteClick} closeOnSelect={false}>
          {t('c:delete')}
        </DropdownActionItem>
      </>,
      {
        id: `task-options-${task.id}`,
        triggerId: `task-options-btn-${task.id}${isSheet ? '-sheet' : ''}`,
        triggerRef,
        align: 'end',
        kind: 'menu',
        // Match the task panel header's ellipsis menu width.
        popupClassName: 'min-w-48',
      },
    );
  };

  return (
    <TooltipButton toolTipContent={t('c:options')} side="top" sideOffset={5}>
      <Button
        onClick={({ currentTarget }) => openOptionsDropdown(currentTarget)}
        aria-label={t('c:resource_options', { resource: t('c:task') })}
        variant="ghost"
        className="focus-inset h-8 w-8 data-dropdowner-active:bg-accent/50"
        size="xs"
      >
        <DropdownerTriggerIcon icon={EllipsisVerticalIcon} className="size-3.5" />
      </Button>
    </TooltipButton>
  );
}
