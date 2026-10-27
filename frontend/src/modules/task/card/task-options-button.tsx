import { CopyIcon, EllipsisVerticalIcon, LinkIcon, Maximize2Icon, TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import { titleFromDocument } from 'shared/blocknote';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import { DropdownActionItem, DropdownActionSeparator } from '~/modules/common/dropdowner/dropdown-action-item';
import { DropdownerTriggerIcon } from '~/modules/common/dropdowner/trigger-icon';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { NamedText } from '~/modules/common/named-text';
import { DeleteQuestion } from '~/modules/common/popconfirm';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { DeleteTasks } from '~/modules/task/delete-tasks';
import { openTaskSheet } from '~/modules/task/helpers/board-navigation';
import { copyTasksToClipboard } from '~/modules/task/helpers/copy-tasks';
import { setCurrentItem } from '~/modules/task/helpers/focus-item';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';

interface TaskOptionsButtonProps {
  task: Task;
  isSheet?: boolean;
}

export function TaskOptionsButton({ task, isSheet = false }: TaskOptionsButtonProps) {
  const { t } = useTranslation();
  const { copyToClipboard } = useCopyToClipboard(2000);

  const shareLink = `${appConfig.backendUrl}/t/${task.id}`;

  const openOptionsDropdown = (currentTarget: HTMLButtonElement) => {
    const { create } = dropdowner.getState();
    // The button carries no `id`: a caller-supplied `id` on a Base UI tooltip trigger makes the tooltip flash and close.
    const triggerRef = { current: currentTarget };

    // `task.name` is empty for a task made in the app: its title is the text of its summary block
    const title = titleFromDocument(task.summary);
    const deleteQuestion = title ? (
      <DeleteQuestion resource="c:task" name={title} />
    ) : (
      <NamedText i18nKey="c:confirm.delete_counted_resource" values={{ count: 1, resource: t('c:task').toLowerCase() }} />
    );

    create(
      <>
        {!isSheet && (
          <>
            <DropdownActionItem
              icon={Maximize2Icon}
              onSelect={() => {
                setCurrentItem(null);
                openTaskSheet(task.id);
                dropdowner.getState().remove();
              }}
            >
              {t('c:expand')}
            </DropdownActionItem>
            <DropdownActionSeparator />
          </>
        )}
        <DropdownActionItem
          icon={CopyIcon}
          closeOnSelect={false}
          onSelect={async () => {
            if (await copyTasksToClipboard([task])) dropdowner.getState().complete(t('c:copied'));
          }}
        >
          {t('c:copy_content')}
        </DropdownActionItem>
        <DropdownActionItem
          icon={LinkIcon}
          closeOnSelect={false}
          onSelect={async () => {
            if (await copyToClipboard(shareLink)) dropdowner.getState().complete(t('c:copied'));
          }}
        >
          {t('c:copy_as_link')}
        </DropdownActionItem>
        <DropdownActionSeparator />
        <DropdownActionItem icon={TrashIcon} variant="destructive" confirm={{ title: deleteQuestion, content: <DeleteTasks tasks={[task]} /> }}>
          {t('c:delete')}
        </DropdownActionItem>
      </>,
      {
        id: `task-options-${task.id}`,
        triggerId: `task-options-btn-${task.id}${isSheet ? '-sheet' : ''}`,
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
        aria-label={t('c:resource_options', { resource: t('c:task') })}
        variant="ghost"
        className="focus-inset size-8 data-dropdowner-active:bg-accent/50"
        size="xs"
      >
        <DropdownerTriggerIcon icon={EllipsisVerticalIcon} className="size-3.5" />
      </Button>
    </TooltipButton>
  );
}
