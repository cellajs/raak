import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { useReadOnlyInert } from '~/modules/task/hooks/use-read-only';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';

/**
 * The task's primary label (task type) icon rendered as a button that opens the primary
 * label dropdown. Shared by the collapsed card content and the expanded card header.
 * `group-data-[sheet]` is a no-op outside a sheet, so the collapsed (non-sheet) case is unaffected.
 */
export const TaskPrimaryLabelButton = ({ task, isSheet = false }: { task: Task; isSheet?: boolean }) => {
  const { onPrimaryLabelChange } = useTaskFieldHandlers(task);
  const readOnlyInert = useReadOnlyInert(task.projectId);

  return (
    <Button
      id={`primaryLabel-${task.id}${isSheet ? '-sheet' : ''}`}
      onClick={({ currentTarget }) =>
        handleTaskDropdownClick({
          dropdownType: 'primaryLabel',
          value: task.primaryLabelId,
          projectId: task.projectId,
          onChange: onPrimaryLabelChange,
          triggerId: currentTarget.id,
          triggerRef: { current: currentTarget },
          taskId: task.id,
        })
      }
      aria-label="Set type"
      variant="ghost"
      size="xs"
      className="relative -ml-0.5 opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100 group-data-[sheet]/task:opacity-100"
      {...readOnlyInert}
    >
      <PrimaryLabelIcon label={task.primaryLabel} />
    </Button>
  );
};
