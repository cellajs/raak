import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { useReadOnlyInert } from '~/modules/task/hooks/use-read-only';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { variantOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';

/**
 * The task's variant (feature/chore/bug) icon rendered as a button that opens the variant
 * dropdown. Shared by the collapsed card content and the expanded card header.
 * `group-data-[sheet]` is a no-op outside a sheet, so the collapsed (non-sheet) case is unaffected.
 */
export const TaskVariantButton = ({ task, isSheet = false }: { task: Task; isSheet?: boolean }) => {
  const { onVariantChange } = useTaskFieldHandlers(task);
  const readOnlyInert = useReadOnlyInert(task.projectId);

  return (
    <Button
      id={`variant-${task.id}${isSheet ? '-sheet' : ''}`}
      onClick={({ currentTarget }) =>
        handleTaskDropdownClick({
          dropdownType: 'variant',
          value: task.variant,
          onChange: onVariantChange,
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
      {variantOptionsByValue[task.variant]?.icon() ?? null}
    </Button>
  );
};
