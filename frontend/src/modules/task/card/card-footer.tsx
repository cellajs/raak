import dayjs from 'dayjs';
import { ChevronDownIcon, TagIcon, UserXIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useRelativeDate } from '~/hooks/use-relative-date';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { NotSelected } from '~/modules/task/dropdowns/point-icons/not-selected';
import type { DropdownsType } from '~/modules/task/dropdowns/types';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { handleTaskSelect } from '~/modules/task/helpers/task-selection';
import { useReadOnlyHide, useReadOnlyInert } from '~/modules/task/hooks/use-read-only';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { pointsOptions, statusOptions, TaskStatus, TaskVariant } from '~/modules/task/task-properties';
import { statusButtonVariants } from '~/modules/task/task-styles';
import type { Task, TaskPointsType } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { Checkbox } from '~/modules/ui/checkbox';
import { useUserStore } from '~/modules/user/user-store';
import { cn } from '~/utils/cn';

interface TasksFooterProps {
  task: Task;
  isSelected: boolean;
  isSheet?: boolean;
}

export const TaskCardFooter = memo(function TaskFooter({ task, isSelected, isSheet = false }: TasksFooterProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const readOnlyInert = useReadOnlyInert(task.projectId);
  const readOnlyHide = useReadOnlyHide(task.projectId);

  const taskState = useTaskCardStore((s) => s.states[task.id] ?? 'collapsed');
  // On mobile, expanded/editing cards move labels onto their own line above the footer,
  // freeing horizontal space to reveal the select checkbox and status dropdown sub-button.
  const isExpandedMobile = isMobile && taskState !== 'collapsed';

  const handlers = useTaskFieldHandlers(task);

  const { user } = useUserStore();
  const statusChangedRelative = useRelativeDate(task.statusChangedAt, user?.language || 'en');
  const isJustNow = dayjs().diff(dayjs.utc(task.statusChangedAt)) <= 1000;
  const isRelative = /^\d/.test(statusChangedRelative); // "2h", "5m" → use "ago"; "May 5" → don't
  const statusTooltip = isJustNow
    ? t('c:status_updated_just_now')
    : isRelative
      ? t('c:status_updated_at', { when: statusChangedRelative })
      : t('c:status_updated_on', { when: statusChangedRelative });

  const selectedPoints = task.points !== null && task.points !== undefined ? pointsOptions[task.points] : null;

  const onDropdownOpen = (currentTarget: EventTarget & HTMLButtonElement, dropdownType: DropdownsType) => {
    const base = { triggerId: currentTarget.id, triggerRef: { current: currentTarget }, taskId: task.id };

    if (dropdownType === 'points') {
      handleTaskDropdownClick({
        ...base,
        dropdownType,
        value: task.points as TaskPointsType,
        onChange: handlers.onPointsChange,
      });
    } else if (dropdownType === 'labels') {
      handleTaskDropdownClick({
        ...base,
        dropdownType,
        value: task.labels,
        projectId: task.projectId,
        onChange: handlers.onLabelsChange,
      });
    } else if (dropdownType === 'assignedTo') {
      handleTaskDropdownClick({
        ...base,
        dropdownType,
        value: task.assignedTo,
        projectId: task.projectId,
        onChange: handlers.onAssignedToChange,
      });
    } else if (dropdownType === 'status') {
      handleTaskDropdownClick({ ...base, dropdownType, value: task.status, onChange: handlers.onStatusChange });
    } else {
      handleTaskDropdownClick({ ...base, dropdownType, value: task.variant, onChange: handlers.onVariantChange });
    }
  };

  const labelsButton = (
    <Button
      id={`labels-${task.id}${isSheet ? '-sheet' : ''}`}
      onClick={({ currentTarget }) => onDropdownOpen(currentTarget, 'labels')}
      aria-label="Set labels"
      variant="ghost"
      size="xs"
      className="sm: relative flex h-auto min-h-8 min-w-8 px-0.5 py-0.5 opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100"
      {...readOnlyInert}
    >
      {task.labels.length > 0 ? (
        isMobile ? (
          <div className="flex flex-wrap items-center gap-0.5 truncate font-xs text-[.75rem]">
            <Badge
              variant="outline"
              key={task.labels[0].id}
              className="inline-block h-4 max-w-24 truncate border-0 bg-transparent px-1 py-0 font-normal leading-4 last:mr-0"
            >
              {task.labels[0].name}
            </Badge>
            {task.labels.length > 1 && (
              <Badge
                variant="outline"
                className="flex h-4 justify-center border-0 bg-transparent px-1 py-0 font-normal"
              >
                +{task.labels.length - 1}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-0.5 truncate">
            {task.labels.map(({ name, id }) => {
              return (
                <div
                  key={id}
                  className="flex max-w-24 flex-wrap items-center justify-center rounded-full px-0 align-center"
                >
                  <Badge
                    variant="outline"
                    key={id}
                    className="inline-block h-4 max-w-32 shrink truncate border-0 bg-transparent px-1 py-0 font-normal text-[.75rem] leading-4 opacity-75 shadow-none last:mr-0"
                  >
                    {name}
                  </Badge>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <TagIcon size={16} className="opacity-60" />
      )}
    </Button>
  );

  return (
    <div
      className={cn(
        'flex flex-col',
        isExpandedMobile &&
          'group-[.is-expanded]/task:fade-in group-[.is-expanded]/task:animate-in group-[.is-expanded]/task:duration-300',
      )}
    >
      {/* On mobile, show labels on their own line above the footer when expanded */}
      {isExpandedMobile && <div className="mb-1 flex flex-row items-center">{labelsButton}</div>}
      <div className="group-[.is-expanded]/task:fade-in flex flex-row items-center group-[.is-expanded]/task:animate-in group-[.is-expanded]/task:duration-300 sm:gap-1">
        {!isSheet && (
          <Checkbox
            className={cn(
              'mx-1 border-foreground/40 opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100 data-[state=checked]:border-primary',
              !isExpandedMobile && 'max-sm:hidden',
              readOnlyHide,
            )}
            checked={isSelected}
            onCheckedChange={(checked) => handleTaskSelect(checked, task)}
          />
        )}
        {task.variant !== TaskVariant.Bug && (
          <Button
            id={`points-${task.id}${isSheet ? '-sheet' : ''}`}
            onClick={({ currentTarget }) => onDropdownOpen(currentTarget, 'points')}
            aria-label="Set points"
            variant="ghost"
            size="xs"
            className="relative opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100"
            {...readOnlyInert}
          >
            {selectedPoints === null || selectedPoints === undefined ? (
              <NotSelected className="size-4 fill-current opacity-70" aria-hidden="true" />
            ) : (
              <selectedPoints.icon className="size-4 fill-current" aria-hidden="true" />
            )}
          </Button>
        )}

        {/* Labels are rendered above on mobile when expanded */}
        {!isExpandedMobile && labelsButton}
        <div className="ml-auto flex">
          <Button
            id={`assignedTo-${task.id}${isSheet ? '-sheet' : ''}`}
            onClick={({ currentTarget }) => onDropdownOpen(currentTarget, 'assignedTo')}
            aria-label="Assign"
            variant="ghost"
            size="xs"
            className="relative mr-1 flex min-w-8 justify-center gap-2 px-1 opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100"
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
                      className="h-6 w-6 text-xs"
                    />
                  ))}
                </AvatarGroupList>
                <AvatarOverflowIndicator className="h-6 w-6 text-xs" />
              </AvatarGroup>
            ) : (
              <UserXIcon className="h-4 w-4 opacity-60" />
            )}
          </Button>

          <TooltipButton toolTipContent={statusTooltip} side="top">
            <Button
              onClick={() => handlers.onStatusChange(task.status - 1)}
              disabled={task.status === TaskStatus.Accepted}
              variant="outlineGhost"
              size="xs"
              className={cn(
                'relative mr-1 font-normal disabled:opacity-100 [&:not(.absolute)]:active:translate-y-0',
                !readOnlyHide && 'sm:rounded-r-none sm:border-r-0',
                !readOnlyHide && isExpandedMobile && 'rounded-r-none border-r-0',
                statusButtonVariants({ status: task.status }),
              )}
              {...readOnlyInert}
            >
              {t(`c:${readOnlyHide ? statusOptions[task.status].status : statusOptions[task.status].action}`)}
            </Button>
          </TooltipButton>
          <TooltipButton toolTipContent={statusTooltip} side="top">
            <Button
              id={`status-${task.id}${isSheet ? '-sheet' : ''}`}
              onClick={({ currentTarget }) => onDropdownOpen(currentTarget, 'status')}
              aria-label="Set status"
              variant="outlineGhost"
              size="xs"
              className={cn(
                'relative -ml-1 rounded-none rounded-r px-2 [&:not(.absolute)]:active:translate-y-0 [&>svg]:transition-transform data-dropdowner-active:[&>svg]:rotate-180',
                !isExpandedMobile && 'max-sm:hidden',
                statusButtonVariants({ status: task.status }),
                readOnlyHide,
              )}
              {...readOnlyInert}
            >
              <ChevronDownIcon size={14} strokeWidth={2} />
            </Button>
          </TooltipButton>
        </div>
      </div>
    </div>
  );
});
