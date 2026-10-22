import { useTranslation } from 'react-i18next';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useRelativeDate } from '~/hooks/use-relative-date';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { CardCloseButton } from '~/modules/task/card/card-close-button';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { TaskDragHandle } from '~/modules/task/card/task-drag-handle';
import { TaskOptionsButton } from '~/modules/task/card/task-options-button';
import { TaskPrimaryLabelButton } from '~/modules/task/card/task-primary-label-button';
import { taskCardActionsReveal } from '~/modules/task/task-styles';
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

  const relativeDate = useRelativeDate(task.createdAt, 'ago');

  return (
    <div className="flex w-full flex-row items-start justify-between py-1">
      {/* A phone has no description gutter, so the grip sits beside the type button; from sm up that button drops into the gutter */}
      <div className={cn('flex shrink-0 sm:flex-col', showDragHandle && 'sm:-mb-8')}>
        {showDragHandle && <TaskDragHandle task={task} animateIn={animateClose} />}
        <TaskPrimaryLabelButton task={task} isSheet={isSheet} />
      </div>
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
            <TooltipButton toolTipContent={`${t('c:created_at')} ${dateShort(task.createdAt)}`} side="bottom" sideOffset={5} hideWhenDetached>
              <span className="ml-1 text-center text-xs opacity-50">{isOnline ? relativeDate : t('c:update_on_online')}</span>
            </TooltipButton>
          </>
        )}

        <div className="grow" />

        {/* The ellipsis comes last so it sits where a collapsed card shows it. A phone has no hover to reveal them. */}
        <div className={cn('flex flex-row items-center gap-1', taskCardActionsReveal, 'max-sm:opacity-100')}>
          {!isSheet && <CardCloseButton animateIn={animateClose} onClick={() => useTaskCardStore.getState().setTaskState(task.id, 'collapsed')} />}
          <TaskOptionsButton task={task} isSheet={isSheet} />
        </div>
      </div>
    </div>
  );
}
