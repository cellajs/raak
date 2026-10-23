import { env } from '~/env';
import { CardCloseExit } from '~/modules/task/card/card-close-button';
import { TaskCardSummaryButtons } from '~/modules/task/card/card-summary-buttons';
import { DescriptionEditButton } from '~/modules/task/card/description-edit-button';
import { TaskSummaryHtml } from '~/modules/task/card/summary-html';
import { TaskDragHandle } from '~/modules/task/card/task-drag-handle';
import { TaskMatchReason } from '~/modules/task/card/task-match-reason';
import { TaskOptionsButton } from '~/modules/task/card/task-options-button';
import { TaskPrimaryLabelButton } from '~/modules/task/card/task-primary-label-button';
import { taskCardActionsRevealClass } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { cn } from '~/utils/cn';

interface TaskContentCollapsedProps {
  task: Task;
  /** The card just collapsed: the header's close button pops out beside the options button. */
  animateClose?: boolean;
  showDragHandle?: boolean;
  onEditRequest?: () => void;
}

/**
 * TaskContentCollapsed is responsible for rendering the task content in its "collapsed" state, which shows a summary only as main content.
 */
export function TaskCardContentCollapsed({ task, animateClose = false, showDragHandle = false, onEditRequest }: TaskContentCollapsedProps) {
  return (
    <div className="relative flex w-full flex-row gap-1">
      <div className="flex shrink-0 flex-col">
        {showDragHandle && <TaskDragHandle task={task} />}
        <TaskPrimaryLabelButton task={task} />
      </div>
      {/* Grows to the card edge so the fade under the options button sits at the edge, not at the end of a short title */}
      <div className="task-summary-fade mt-1.5 mb-1 ml-1 inline min-w-0 grow leading-tight">
        <TaskSummaryHtml className="inline leading-tight" task={task} />
        {env.VITE_DEBUG_MODE && <span className="ml-2 text-muted-foreground/50">#{task.displayOrder}</span>}
        <TaskCardSummaryButtons task={task} />
        <TaskMatchReason task={task} className="mt-1" />
      </div>
      {/* Frames the summary from beside it: the summary's fade mask would clip a ring drawn inside it */}
      {onEditRequest && <DescriptionEditButton onClick={onEditRequest} className="top-0 -right-2 bottom-0 left-8" />}
      <div className={cn('absolute top-0 right-0 flex items-center gap-1', taskCardActionsRevealClass)}>
        {animateClose && <CardCloseExit />}
        <TaskOptionsButton task={task} />
      </div>
    </div>
  );
}
