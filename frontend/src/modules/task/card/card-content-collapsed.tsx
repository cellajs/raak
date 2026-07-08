import { env } from '~/env';
import { BlockNoteMinimalHtml } from '~/modules/common/blocknote/minimal-html';
import { TaskCardSummaryButtons } from '~/modules/task/card/card-summary-buttons';
import { TaskVariantButton } from '~/modules/task/card/task-variant-button';
import type { Task } from '~/modules/task/types';

interface TaskContentCollapsedProps {
  task: Task;
}

/**
 * TaskContentCollapsed is responsible for rendering the task content in its "collapsed" state, which shows a summary only as main content.
 */
export const TaskCardContentCollapsed = ({ task }: TaskContentCollapsedProps) => {
  return (
    <div className="flex w-full flex-row gap-1">
      <TaskVariantButton task={task} />
      <div className="mt-1.5 mb-1 ml-1 inline leading-none opacity-90 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100">
        <BlockNoteMinimalHtml className="inline leading-none" html={task.summary} />
        {env.VITE_DEBUG_MODE && <span className="ml-2 text-muted">#{task.displayOrder}</span>}
        <TaskCardSummaryButtons item={task} />
      </div>
    </div>
  );
};
