import { env } from '~/env';
import { CardCloseExit } from '~/modules/task/card/card-close-button';
import { TaskCardSummaryButtons } from '~/modules/task/card/card-summary-buttons';
import { TaskSummaryHtml } from '~/modules/task/card/summary-html';
import { TaskMatchReason } from '~/modules/task/card/task-match-reason';
import { TaskOptionsButton } from '~/modules/task/card/task-options-button';
import { TaskPrimaryLabelButton } from '~/modules/task/card/task-primary-label-button';
import { taskCardActionsReveal } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { cn } from '~/utils/cn';

interface TaskContentCollapsedProps {
  task: Task;
  /** The card just collapsed: the header's close button pops out beside the options button. */
  animateClose?: boolean;
}

/**
 * TaskContentCollapsed is responsible for rendering the task content in its "collapsed" state, which shows a summary only as main content.
 */
export function TaskCardContentCollapsed({ task, animateClose = false }: TaskContentCollapsedProps) {
  return (
    // min-h-9 fits the options button (top-1 + h-8): a one-line card is only as tall as the type button, so it overlapped the footer
    <div className="relative flex min-h-9 w-full flex-row gap-1">
      <TaskPrimaryLabelButton task={task} />
      {/* Grows to the card edge so the fade under the options button sits at the edge, not at the end of a short title */}
      <div className="task-summary-fade mt-1.5 mb-1 ml-1 inline min-w-0 grow leading-tight">
        <TaskSummaryHtml className="inline leading-tight" task={task} />
        {env.VITE_DEBUG_MODE && <span className="ml-2 text-muted-foreground/50">#{task.displayOrder}</span>}
        <TaskCardSummaryButtons task={task} />
        <TaskMatchReason task={task} className="mt-1" />
      </div>
      {/* top-1 matches the expanded header's py-1, so the button keeps its place on expand and collapse */}
      <div className={cn('absolute top-1 right-0 flex items-center gap-1', taskCardActionsReveal)}>
        {animateClose && <CardCloseExit />}
        <TaskOptionsButton task={task} />
      </div>
    </div>
  );
}
