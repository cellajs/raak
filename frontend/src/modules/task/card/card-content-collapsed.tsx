import { env } from '~/env';
import { BlockNoteMinimalHtml } from '~/modules/common/blocknote/minimal-html';
import { TaskCardSummaryButtons } from '~/modules/task/card/card-summary-buttons';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { useReadOnlyInert } from '~/modules/task/hooks/use-read-only';
import { useTaskFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { variantOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';

interface TaskContentCollapsedProps {
  task: Task;
}

/**
 * TaskContentCollapsed is responsible for rendering the task content in its "collapsed" state, which shows a summary only as main content.
 */
export const TaskCardContentCollapsed = ({ task }: TaskContentCollapsedProps) => {
  const handlers = useTaskFieldHandlers(task);

  return (
    <div className="flex w-full flex-row gap-1">
      <Button
        id={`variant-${task.id}`}
        onClick={({ currentTarget }) =>
          handleTaskDropdownClick({
            dropdownType: 'variant',
            value: task.variant,
            onChange: handlers.onVariantChange,
            triggerId: currentTarget.id,
            triggerRef: { current: currentTarget },
            taskId: task.id,
          })
        }
        aria-label="Set type"
        variant="ghost"
        size="xs"
        className="relative -ml-0.5 opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100"
        {...useReadOnlyInert(task.projectId)}
      >
        {variantOptionsByValue[task.variant]?.icon() ?? null}
      </Button>
      <div className="mt-1.5 mb-1 ml-1 inline leading-none opacity-90 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100">
        <BlockNoteMinimalHtml className="inline leading-none" html={task.summary} />
        {env.VITE_DEBUG_MODE && <span className="ml-2 text-muted">#{task.displayOrder}</span>}
        <TaskCardSummaryButtons item={task} />
      </div>
    </div>
  );
};
