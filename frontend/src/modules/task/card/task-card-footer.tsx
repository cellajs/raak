import dayjs from 'dayjs';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useRelativeDate } from '~/hooks/use-relative-date';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { useIsProjectReadOnly, useReadOnlyInert } from '~/modules/project/use-read-only';
import { CardTooltip } from '~/modules/task/card/card-tooltip';
import { TaskCardLabels } from '~/modules/task/card/task-card-labels';
import { TaskStartCheck } from '~/modules/task/card/task-start-check';
import { openTaskFieldDropdown, taskFieldTriggerId } from '~/modules/task/helpers/open-task-dropdown';
import { setTaskSelected } from '~/modules/task/helpers/task-selection';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { NoAssigneeAvatar } from '~/modules/task/no-assignee-avatar';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import {
  statusButtonVariants,
  statusIconInTextClass,
  statusTextColors,
  taskCardAvatarRestClass,
  taskCardGhostClass,
} from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Button } from '~/modules/ui/button';
import { Checkbox } from '~/modules/ui/checkbox';
import { useUserStore } from '~/modules/user/user-store';
import { cn } from '~/utils/cn';

interface TaskCardFooterProps {
  task: Task;
  isSelected: boolean;
  isSheet?: boolean;
}

export const TaskCardFooter = memo(function TaskCardFooter({ task, isSelected, isSheet = false }: TaskCardFooterProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const readOnlyInert = useReadOnlyInert(task.projectId);
  const isReadOnly = useIsProjectReadOnly(task.projectId);

  const isOtherProjectSelected = useTaskInteractionStore((state) => !!state.selectedProjectId && state.selectedProjectId !== task.projectId);

  const handlers = useTaskFieldHandlers(task);
  const currentUserId = useUserStore((state) => state.user?.id);

  const statusChangedRelative = useRelativeDate(task.statusChangedAt);
  const isJustNow = dayjs().diff(dayjs.utc(task.statusChangedAt)) <= 1000;
  const isRelative = /^\d/.test(statusChangedRelative); // "2h", "5m" → use "ago"; "May 5" → don't
  const assigneeTooltip = `${t('c:assigned_to')}: ${task.assignedTo.length ? task.assignedTo.map(({ name }) => name).join(', ') : t('c:no_one')}`;

  const { name: statusName, icon: StatusIcon } = statusOptionsByValue[task.status];
  // "Backlog just now" reads as a label, not an event
  const statusEvent = task.status === TaskStatus.Unstarted ? t('c:added_to_backlog') : t(`c:${statusName}`);
  const statusTooltip = isJustNow
    ? t('c:status_updated_just_now', { status: statusEvent })
    : isRelative
      ? t('c:status_updated_at', { status: statusEvent, when: statusChangedRelative })
      : t('c:status_updated_on', { status: statusEvent, when: statusChangedRelative });
  // The column under the type icon holds the checkbox. A selection holds one project's tasks, so another project, like a read-only one, leaves it empty.
  const hasCheckboxColumn = !isSheet;
  const canSelect = !isReadOnly && !isOtherProjectSelected;

  return (
    <div className="group-not-data-[state=collapsed]/task:fade-in flex flex-col group-not-data-[state=collapsed]/task:animate-in group-not-data-[state=collapsed]/task:duration-300">
      <div className="@container/footer flex items-center gap-1">
        {hasCheckboxColumn && (
          <div className="mx-1 flex size-5 shrink-0 items-center justify-center">
            {canSelect && (
              <Checkbox
                className="bg-background/40"
                aria-label={t('c:select_resource', { resource: task.name })}
                checked={isSelected}
                onCheckedChange={(checked) => setTaskSelected(checked, task)}
              />
            )}
          </div>
        )}
        {isReadOnly ? (
          // A fact, not a control
          <TooltipButton toolTipContent={statusTooltip} side="top">
            <div className={cn('flex h-8 items-center gap-1.5 font-medium text-sm', statusTextColors[task.status], statusIconInTextClass)}>
              <StatusIcon aria-hidden className="size-4 shrink-0" />
              <span>
                <span className="sr-only">{t('c:status')}: </span>
                {t(`c:${statusName}`)}
              </span>
            </div>
          </TooltipButton>
        ) : (
          // On the group, not per button: moving between the two would close one tooltip and open another. Also reaches a disabled button.
          <TooltipButton toolTipContent={statusTooltip} side="top">
            {/* Split: the icon tells where the task stands and opens the status menu, the verb takes the next step */}
            <div data-task-status-control={task.id} className="relative flex">
              <Button
                id={taskFieldTriggerId('status', task.id, isSheet)}
                onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'status', handlers, currentTarget)}
                aria-label={`${t('c:status')}: ${t(`c:${statusName}`)}`}
                variant="outline-ghost"
                size="xs"
                press={false}
                className={cn('rounded-r-none border-r-0 px-2', statusButtonVariants({ status: task.status }), statusIconInTextClass)}
              >
                <StatusIcon aria-hidden className="size-4 shrink-0" />
              </Button>
              <Button
                onClick={() => handlers.onStatusChange(statusOptionsByValue[task.status].next)}
                disabled={task.status === TaskStatus.Accepted}
                variant="outline-ghost"
                size="xs"
                press={false}
                className={cn('mr-1 rounded-l-none disabled:opacity-100', statusButtonVariants({ status: task.status }))}
              >
                {t(`c:${statusOptionsByValue[task.status].action}`)}
              </Button>
              {/* The action keeps its mr-1, which the check's tooltip must not center over */}
              <TaskStartCheck taskId={task.id} className="right-1" />
            </div>
          </TooltipButton>
        )}
        <TaskCardLabels task={task} isSheet={isSheet} isCompact={!isSheet || isMobile} />
        {/* Its edge on the card's, so a lone avatar centers under the options button */}
        <CardTooltip content={assigneeTooltip} className="ml-auto">
          <Button
            id={taskFieldTriggerId('assignedTo', task.id, isSheet)}
            onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'assignedTo', handlers, currentTarget)}
            aria-label={t('c:assign_to')}
            variant="ghost"
            size="xs"
            className={cn('min-w-8 px-0.5', taskCardGhostClass)}
            {...readOnlyInert}
          >
            {task.assignedTo.length > 0 ? (
              <AvatarGroup limit={isMobile ? 2 : 3}>
                <AvatarGroupList>
                  {task.assignedTo.map((user) => (
                    <EntityAvatar
                      type="user"
                      key={user.id}
                      id={user.id}
                      name={user.name}
                      url={user.thumbnailUrl}
                      // Overlapping greys would merge. The only assignee question on a board is "is this mine?", so your own keeps its color.
                      className={cn('size-7 not-first:ring-1 not-first:ring-background', user.id !== currentUserId && taskCardAvatarRestClass)}
                    />
                  ))}
                </AvatarGroupList>
                <AvatarOverflowIndicator className="size-7 text-xs" />
              </AvatarGroup>
            ) : (
              <NoAssigneeAvatar className="size-7" />
            )}
          </Button>
        </CardTooltip>
      </div>
    </div>
  );
});
