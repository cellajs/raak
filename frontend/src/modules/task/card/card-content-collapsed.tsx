import { env } from '~/env';
import { TaskCardSummaryButtons } from '~/modules/task/card/card-summary-buttons';
import { TaskSummaryHtml } from '~/modules/task/card/summary-html';
import { TaskPrimaryLabelButton } from '~/modules/task/card/task-primary-label-button';
import type { Task } from '~/modules/task/types';

interface TaskContentCollapsedProps {
  task: Task;
}

/**
 * TaskContentCollapsed is responsible for rendering the task content in its "collapsed" state, which shows a summary only as main content.
 */
export function TaskCardContentCollapsed({ task }: TaskContentCollapsedProps) {
  return (
    <div className="flex w-full flex-row gap-1">
      <TaskPrimaryLabelButton task={task} />
      <div className="mt-1.5 mb-1 ml-1 inline leading-tight">
        <TaskSummaryHtml className="inline leading-tight" task={task} />
        {env.VITE_DEBUG_MODE && <span className="ml-2 text-muted-foreground">#{task.displayOrder}</span>}
        <TaskCardSummaryButtons task={task} />
      </div>
    </div>
  );
}
