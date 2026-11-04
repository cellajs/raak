import { TagPlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { HighlightText } from '~/modules/common/match-highlight/highlight-text';
import { useReadOnlyHide, useReadOnlyInert } from '~/modules/project/use-read-only';
import { CardTooltip } from '~/modules/task/card/card-tooltip';
import { openTaskFieldDropdown, taskFieldTriggerId } from '~/modules/task/helpers/open-task-dropdown';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { taskCardGhostClass, taskCardMetaClass } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

const pillClass = 'inline-block max-w-32 truncate px-1 font-normal text-[0.8125rem] leading-5';

// A closed card shows as many pills as its footer width fits, by step, then a count of the rest
const fitClasses = ['', '@max-[24rem]/footer:hidden', '@max-[32rem]/footer:hidden'];
const countClasses = ['@max-[24rem]/footer:inline-block', '@min-[24rem]/footer:@max-[32rem]/footer:inline-block', '@min-[32rem]/footer:inline-block'];

interface TaskCardLabelsProps {
  task: Task;
  isSheet?: boolean;
  /** One line of labels, then a count: wrapping beside the status button would stack them. */
  isCompact?: boolean;
}

/** A task's labels as pills after the status button, which open the labels menu; without labels, an add button. */
export function TaskCardLabels({ task, isSheet = false, isCompact = false }: TaskCardLabelsProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const handlers = useTaskFieldHandlers(task);
  const readOnlyInert = useReadOnlyInert(task.projectId);
  const readOnlyHide = useReadOnlyHide(task.projectId);
  const { labels } = task;
  const hasLabels = labels.length > 0;

  const button = (
    <Button
      id={taskFieldTriggerId('labels', task.id, isSheet)}
      onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'labels', handlers, currentTarget, !isMobile || !isCompact)}
      aria-label={
        hasLabels ? `${t('c:label_other')}: ${labels.map(({ name }) => name).join(', ')}` : t('c:add_resource', { resource: t('c:label_other') })
      }
      variant="ghost"
      size="xs"
      className={cn(
        taskCardGhostClass,
        taskCardMetaClass,
        hasLabels ? cn('min-w-0 px-1', !isCompact && 'h-auto min-h-8 py-1.5') : cn('size-8 shrink-0 p-0', readOnlyHide),
      )}
      {...readOnlyInert}
    >
      {hasLabels ? (
        <span className={cn('flex min-w-0 items-center gap-0.5', isCompact ? 'overflow-hidden' : 'flex-wrap')}>
          {labels.map(({ id, name }, index) => (
            <span key={id} className={cn(pillClass, isCompact && cn('min-w-0 shrink', index < fitClasses.length ? fitClasses[index] : 'hidden'))}>
              <HighlightText text={name} />
            </span>
          ))}
          {isCompact &&
            countClasses.map(
              (countClass, index) =>
                labels.length > index + 1 && (
                  <span key={countClass} className={cn(pillClass, 'hidden shrink-0', countClass)}>
                    +{labels.length - index - 1}
                  </span>
                ),
            )}
        </span>
      ) : (
        <TagPlusIcon className="size-4.5" />
      )}
    </Button>
  );

  return hasLabels ? button : <CardTooltip content={t('c:add_resource', { resource: t('c:label_other') })}>{button}</CardTooltip>;
}
