import { useTranslation } from 'react-i18next';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { RelativeDate } from '~/modules/common/relative-date';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { CardCloseButton } from '~/modules/task/card/card-close-button';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { TaskDragHandle } from '~/modules/task/card/task-drag-handle';
import { TaskOptionsButton } from '~/modules/task/card/task-options-button';
import { TaskPrimaryLabelButton } from '~/modules/task/card/task-primary-label-button';
import { focusItem } from '~/modules/task/helpers/focus-item';
import { taskCardActionsRevealClass } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { cn } from '~/utils/cn';
import { dateShort } from '~/utils/date-short';

interface TaskCardHeaderProps {
  task: Task;
  isSheet?: boolean;
  animateClose?: boolean;
  showDragHandle?: boolean;
}

export function TaskCardHeader({ task, isSheet = false, animateClose = false, showDragHandle = false }: TaskCardHeaderProps) {
  const { t } = useTranslation();
  const isOnline = useOnlineManager();

  return (
    <div className="flex w-full items-start justify-between py-1">
      {/* A phone has no description gutter, so the grip unfolds beside the type button; from sm up it pushes that button into the gutter */}
      <div className={cn('flex shrink-0 sm:flex-col', showDragHandle && 'sm:-mb-8')}>
        {showDragHandle && <TaskDragHandle task={task} />}
        <TaskPrimaryLabelButton task={task} isSheet={isSheet} />
      </div>
      <div className="ml-1 flex w-full items-center gap-1">
        {task.createdBy && (
          <>
            <TooltipButton toolTipContent={task.createdBy.name} side="bottom" sideOffset={5} hideWhenDetached>
              <EntityAvatar
                type="user"
                id={task.createdBy.id}
                name={task.createdBy.name}
                url={task.createdBy.thumbnailUrl}
                className="size-6 max-sm:hidden"
              />
            </TooltipButton>
            <TooltipButton toolTipContent={`${t('c:created_at')} ${dateShort(task.createdAt)}`} side="bottom" sideOffset={5} hideWhenDetached>
              <span className="ml-1 text-center text-muted-foreground text-xs">
                {isOnline ? <RelativeDate date={task.createdAt} /> : t('c:update_on_online')}
              </span>
            </TooltipButton>
          </>
        )}

        <div className="grow" />

        {/* Options come last, where a collapsed card shows them. A phone has no hover to reveal the actions. */}
        <div className={cn(taskCardActionsRevealClass, 'flex items-center gap-1 max-sm:opacity-100')}>
          {!isSheet && (
            <CardCloseButton
              animateIn={animateClose}
              className="focus-inset"
              onClick={() => {
                // The button unmounts with the header, which would drop focus out of the card
                focusItem(task.id);
                taskCardStore.getState().setTaskState(task.id, 'collapsed');
              }}
            />
          )}
          <TaskOptionsButton task={task} isSheet={isSheet} />
        </div>
      </div>
    </div>
  );
}
