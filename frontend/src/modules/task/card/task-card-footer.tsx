import dayjs from 'dayjs';
import { ChevronDownIcon, TagIcon, UserXIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useRelativeDate } from '~/hooks/use-relative-date';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { HighlightText } from '~/modules/common/match-highlight/highlight-text';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { useReadOnlyHide, useReadOnlyInert } from '~/modules/project/use-read-only';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { openTaskFieldDropdown, taskFieldTriggerId } from '~/modules/task/helpers/open-task-dropdown';
import { setTaskSelected } from '~/modules/task/helpers/task-selection';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import { statusButtonVariants, taskCardDimClass } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { Checkbox } from '~/modules/ui/checkbox';
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
  const readOnlyHide = useReadOnlyHide(task.projectId);
  const labelsHide = task.labels.length ? '' : readOnlyHide;

  const taskState = useTaskCardStore((state) => state.states[task.id] ?? 'collapsed');
  // Task and label selection are mutually exclusive so the board header's remove button targets one kind
  const hasSelectedLabels = useTaskInteractionStore((state) => state.selectedLabelIds.length > 0);
  const isOtherProjectSelected = useTaskInteractionStore((state) => !!state.selectedProjectId && state.selectedProjectId !== task.projectId);
  // On mobile an open card moves labels onto their own line, freeing room for the select checkbox and status button
  const isExpandedMobile = isMobile && taskState !== 'collapsed';

  const handlers = useTaskFieldHandlers(task);

  const statusChangedRelative = useRelativeDate(task.statusChangedAt);
  const isJustNow = dayjs().diff(dayjs.utc(task.statusChangedAt)) <= 1000;
  const isRelative = /^\d/.test(statusChangedRelative); // "2h", "5m" → use "ago"; "May 5" → don't
  const statusTooltip = isJustNow
    ? t('c:status_updated_just_now')
    : isRelative
      ? t('c:status_updated_at', { when: statusChangedRelative })
      : t('c:status_updated_on', { when: statusChangedRelative });

  const labelsButton = (
    <Button
      id={taskFieldTriggerId('labels', task.id, isSheet)}
      onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'labels', handlers, currentTarget, !isMobile || isExpandedMobile)}
      aria-label={t('c:set_resource', { resource: t('c:label_other').toLowerCase() })}
      variant="ghost"
      size="xs"
      className={cn('h-auto min-h-8 min-w-8 p-0.5', labelsHide)}
      {...readOnlyInert}
    >
      {task.labels.length > 0 ? (
        isMobile && !isExpandedMobile ? (
          <div className="flex flex-wrap items-center gap-0.5 truncate font-normal text-xs leading-4">
            <span className="max-w-24 truncate px-1 lowercase">
              <HighlightText text={task.labels[0].name} />
            </span>
            {task.labels.length > 1 && <span className="px-1">+{task.labels.length - 1}</span>}
          </div>
        ) : (
          <div className="flex flex-wrap gap-0.5 truncate">
            {task.labels.map(({ name, id }) => (
              <div key={id} className="flex max-w-full flex-wrap items-center justify-center">
                <Badge
                  variant="outline"
                  className="inline-block min-h-4 max-w-full shrink truncate border-0 px-1 py-0 font-normal text-muted-foreground leading-4 shadow-none"
                >
                  <HighlightText text={name} />
                </Badge>
              </div>
            ))}
          </div>
        )
      ) : (
        <TagIcon className="opacity-60" />
      )}
    </Button>
  );

  return (
    <div className="group-not-data-[state=collapsed]/task:fade-in flex flex-col group-not-data-[state=collapsed]/task:animate-in group-not-data-[state=collapsed]/task:duration-300">
      {isExpandedMobile && <div className={cn('mb-1 flex items-center', labelsHide)}>{labelsButton}</div>}
      <div className="flex items-center sm:gap-1">
        {!isSheet && (
          <Checkbox
            className={cn('mx-1', !isExpandedMobile && 'max-sm:hidden', readOnlyHide)}
            aria-label={t('c:select_resource', { resource: task.name })}
            checked={isSelected}
            disabled={hasSelectedLabels || isOtherProjectSelected}
            onCheckedChange={(checked) => setTaskSelected(checked, task)}
          />
        )}
        {!isExpandedMobile && labelsButton}
        <div className="ml-auto flex">
          <Button
            id={taskFieldTriggerId('assignedTo', task.id, isSheet)}
            onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'assignedTo', handlers, currentTarget)}
            aria-label={t('c:assign_to')}
            variant="ghost"
            size="xs"
            className={cn(taskCardDimClass, 'mr-1 min-w-8 px-1')}
            {...readOnlyInert}
          >
            {task.assignedTo.length > 0 ? (
              <AvatarGroup limit={isMobile ? 2 : 3}>
                <AvatarGroupList>
                  {task.assignedTo.map((user) => (
                    <EntityAvatar type="user" key={user.id} id={user.id} name={user.name} url={user.thumbnailUrl} className="size-6" />
                  ))}
                </AvatarGroupList>
                <AvatarOverflowIndicator className="size-6 text-xs" />
              </AvatarGroup>
            ) : (
              <UserXIcon className="size-4 opacity-60" />
            )}
          </Button>

          <TooltipButton toolTipContent={statusTooltip} side="top">
            <Button
              onClick={() => handlers.onStatusChange(task.status - 1)}
              disabled={task.status === TaskStatus.Accepted}
              variant="outline-ghost"
              size="xs"
              press={false}
              className={cn(
                'mr-1 font-normal disabled:opacity-100',
                !readOnlyHide && 'sm:rounded-r-none sm:border-r-0',
                !readOnlyHide && isExpandedMobile && 'rounded-r-none border-r-0',
                statusButtonVariants({ status: task.status }),
              )}
              {...readOnlyInert}
            >
              {t(`c:${readOnlyHide ? statusOptionsByValue[task.status].status : statusOptionsByValue[task.status].action}`)}
            </Button>
          </TooltipButton>
          <TooltipButton toolTipContent={statusTooltip} side="top">
            <Button
              id={taskFieldTriggerId('status', task.id, isSheet)}
              onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'status', handlers, currentTarget)}
              aria-label={t('c:set_resource', { resource: t('c:status').toLowerCase() })}
              variant="outline-ghost"
              size="xs"
              press={false}
              className={cn(
                '-ml-1 rounded-none rounded-r px-2 [&>svg]:transition-transform data-dropdowner-active:[&>svg]:rotate-180',
                !isExpandedMobile && 'max-sm:hidden',
                statusButtonVariants({ status: task.status }),
                readOnlyHide,
              )}
              {...readOnlyInert}
            >
              <ChevronDownIcon className="size-3.5" strokeWidth={2} />
            </Button>
          </TooltipButton>
        </div>
      </div>
    </div>
  );
});
