import { useTranslation } from 'react-i18next';
import { labelIconColorClass } from '~/modules/label/label-palette';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { useReadOnlyInert } from '~/modules/project/use-read-only';
import { useShowsUnseenMark } from '~/modules/task/board/unseen-tasks-store';
import { openTaskFieldDropdown, taskFieldTriggerId } from '~/modules/task/helpers/open-task-dropdown';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { taskCardDimClass } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

interface TaskPrimaryLabelButtonProps {
  task: Task;
  isSheet?: boolean;
}

export function TaskPrimaryLabelButton({ task, isSheet = false }: TaskPrimaryLabelButtonProps) {
  const { t } = useTranslation();
  const handlers = useTaskFieldHandlers(task);
  const readOnlyInert = useReadOnlyInert(task.projectId);
  const showsMark = useShowsUnseenMark(task) && !isSheet;

  return (
    <Button
      id={taskFieldTriggerId('primaryLabel', task.id, isSheet)}
      onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'primaryLabel', handlers, currentTarget)}
      aria-label={t('c:set_resource', { resource: t('c:type') })}
      variant="ghost"
      size="xs"
      className={cn(taskCardDimClass, 'focus-inset -ml-0.5 group-data-[sheet=true]/task:opacity-100', showsMark && 'relative opacity-100')}
      {...readOnlyInert}
    >
      {showsMark && <span aria-hidden className={cn('task-unseen-halo', labelIconColorClass(task.primaryLabel?.color))} />}
      <PrimaryLabelIcon label={task.primaryLabel} className={showsMark ? 'relative' : undefined} />
    </Button>
  );
}
