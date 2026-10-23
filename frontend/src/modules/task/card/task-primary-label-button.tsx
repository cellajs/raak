import { useTranslation } from 'react-i18next';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { useReadOnlyInert } from '~/modules/project/use-read-only';
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

/**
 * The task's primary label (task type) icon rendered as a button that opens the primary
 * label dropdown. Shared by the collapsed card content and the expanded card header.
 * `group-data-[sheet]` is a no-op outside a sheet, so the collapsed (non-sheet) case is unaffected.
 */
export function TaskPrimaryLabelButton({ task, isSheet = false }: TaskPrimaryLabelButtonProps) {
  const { t } = useTranslation();
  const handlers = useTaskFieldHandlers(task);
  const readOnlyInert = useReadOnlyInert(task.projectId);

  return (
    <Button
      id={taskFieldTriggerId('primaryLabel', task.id, isSheet)}
      onClick={({ currentTarget }) => openTaskFieldDropdown(task, 'primaryLabel', handlers, currentTarget)}
      aria-label={t('c:set_resource', { resource: t('c:type').toLowerCase() })}
      variant="ghost"
      size="xs"
      className={cn(taskCardDimClass, 'focus-inset -ml-0.5 group-data-[sheet]/task:opacity-100')}
      {...readOnlyInert}
    >
      <PrimaryLabelIcon label={task.primaryLabel} />
    </Button>
  );
}
