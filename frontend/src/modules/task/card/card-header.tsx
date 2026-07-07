import { Link } from '@tanstack/react-router';
import { ChevronUp, CopyIcon, EllipsisVerticalIcon, LinkIcon, Maximize2, TrashIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import { useCopyToClipboard } from '~/hooks/use-copy-to-clipboard';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useRelativeDate } from '~/hooks/use-relative-date';
import { copyBlocksToClipboard } from '~/modules/common/blocknote/helpers/blocknote-helpers';
import { DropdownActionItem } from '~/modules/common/dropdowner/dropdown-action-item';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { PopConfirm } from '~/modules/common/popconfirm';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { DeleteTask } from '~/modules/task/delete-task';
import { focusTask } from '~/modules/task/helpers/focus-task';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { useReadOnlyInert } from '~/modules/task/hooks/use-read-only';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { variantOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { useUserStore } from '~/modules/user/user-store';
import { dateShort } from '~/utils/date-short';
import { truncateMiddle } from '~/utils/truncate-middle';

interface Props {
  task: Task;
  isSheet?: boolean;
}

export const TaskCardHeader = ({ task, isSheet = false }: Props) => {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const isOnline = useOnlineManager();
  const expandButtonRef = useRef<HTMLAnchorElement | null>(null);
  const optionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const shareLink = `${appConfig.backendUrl}/t/${task.id}`;

  const { copyToClipboard } = useCopyToClipboard(2000);

  const relativeDate = useRelativeDate(task.createdAt, user?.language || 'en', 'ago');

  const handlers = useTaskFieldHandlers(task);

  const openOptionsDropdown = () => {
    if (!optionsTriggerRef.current) return;
    const { create } = useDropdowner.getState();
    const isMobile = window.innerWidth < 640;

    const handleDeleteClick = () => {
      const { update, remove } = useDropdowner.getState();
      update({
        kind: 'panel',
        content: (
          <PopConfirm title={t('c:delete_confirm.text', { name: `"${truncateMiddle(task.name, 50)}"` })}>
            <DeleteTask task={task} callback={remove} onCancel={remove} />
          </PopConfirm>
        ),
      });
    };

    create(
      <>
        <DropdownActionItem
          isMobile={isMobile}
          icon={CopyIcon}
          onSelect={async () => {
            const success = await copyBlocksToClipboard(task.description);
            if (success) useDropdowner.getState().remove();
          }}
        >
          {t('c:copy_content')}
        </DropdownActionItem>
        <DropdownActionItem
          isMobile={isMobile}
          icon={LinkIcon}
          onSelect={() => {
            copyToClipboard(shareLink);
            useDropdowner.getState().remove();
          }}
        >
          {t('c:copy_as_link')}
        </DropdownActionItem>
        {isMobile && <div className="my-1 h-px bg-border" />}
        <DropdownActionItem
          isMobile={isMobile}
          icon={TrashIcon}
          variant="destructive"
          onSelect={handleDeleteClick}
          closeOnSelect={false}
        >
          {t('c:delete')}
        </DropdownActionItem>
      </>,
      {
        id: `task-options-${task.id}`,
        triggerId: `task-options-btn-${task.id}${isSheet ? '-sheet' : ''}`,
        triggerRef: optionsTriggerRef,
        align: 'end',
        kind: 'menu',
      },
    );
  };

  return (
    <div className="flex w-full flex-row justify-between py-1">
      <Button
        id={`variant-${task.id}${isSheet ? '-sheet' : ''}`}
        onClick={({ currentTarget }) =>
          handleTaskDropdownClick({
            dropdownType: 'variant',
            value: task.variant,
            onChange: handlers.onVariantChange,
            triggerId: currentTarget.id,
            triggerRef: { current: currentTarget },
            taskId: task.id,
          })
        }
        aria-label="Set type"
        variant="ghost"
        size="xs"
        className="relative -ml-0.5 opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100 group-data-[sheet]/task:opacity-100"
        {...useReadOnlyInert(task.projectId)}
      >
        {variantOptionsByValue[task.variant]?.icon() ?? null}
      </Button>
      <div className="ml-1 flex w-full flex-row items-center gap-1">
        {task.createdBy && (
          <>
            <TooltipButton toolTipContent={task.createdBy.name} side="bottom" sideOffset={5} hideWhenDetached>
              <EntityAvatar
                type="user"
                id={task.createdBy.id}
                name={task.createdBy.name}
                url={task.createdBy.thumbnailUrl}
                className="h-6 w-6 text-xs max-sm:hidden"
              />
            </TooltipButton>
            <TooltipButton
              toolTipContent={`${t('c:created_at')} ${dateShort(task.createdAt)}`}
              side="bottom"
              sideOffset={5}
              hideWhenDetached
            >
              <span className="ml-1 text-center text-sm opacity-50">
                {isOnline ? relativeDate : t('c:update_on_online')}
              </span>
            </TooltipButton>
          </>
        )}

        <div className="grow" />

        <div className="flex flex-row items-center gap-1 opacity-0 transition-opacity group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100 group-data-[sheet]/task:opacity-100">
          <TooltipButton toolTipContent={t('c:options')} side="bottom" sideOffset={5} hideWhenDetached>
            <Button
              ref={optionsTriggerRef}
              id={`task-options-btn-${task.id}${isSheet ? '-sheet' : ''}`}
              onClick={openOptionsDropdown}
              aria-label="Task options"
              variant="ghost"
              className="h-8 w-8 data-dropdowner-active:bg-accent/50"
              size="xs"
            >
              <EllipsisVerticalIcon size={14} />
            </Button>
          </TooltipButton>

          {!isSheet && (
            <TooltipButton toolTipContent={t('c:expand')} side="bottom" sideOffset={5} hideWhenDetached>
              <Button
                variant="ghost"
                size="xs"
                className="h-8 w-8"
                render={
                  <Link
                    to="."
                    ref={expandButtonRef}
                    resetScroll={false}
                    search={(prev) => ({ ...prev, taskSheetId: task.id })}
                    replace={false}
                    onClick={() => {
                      // Store trigger to bring focus back
                      useSheeter.getState().setTriggerRef(task.id, expandButtonRef);
                      focusTask(null);
                    }}
                  />
                }
              >
                <Maximize2 size={14} />
              </Button>
            </TooltipButton>
          )}

          {!isSheet && (
            <TooltipButton toolTipContent={t('c:close')} side="bottom" sideOffset={5} hideWhenDetached>
              <Button
                onClick={() => {
                  useTaskCardStore.getState().setTaskState(task.id, 'collapsed');
                }}
                aria-label="Collapse"
                variant="ghost"
                size="xs"
                className="h-8 w-8"
              >
                <ChevronUp size={16} />
              </Button>
            </TooltipButton>
          )}
        </div>
      </div>
    </div>
  );
};
