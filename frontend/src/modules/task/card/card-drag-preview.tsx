import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { TaskCardFooter } from '~/modules/task/card/card-footer';
import { TaskSummaryHtml } from '~/modules/task/card/summary-html';
import { taskCardVariants } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { Card, CardContent } from '~/modules/ui/card';
import { cn } from '~/utils/cn';

/** A primitive card component for displaying task information during drag operations */
export function TaskCardDragPreview({ task }: { task: Task }) {
  return (
    <Card tabIndex={0} className={cn('rounded-none border bg-card/50 opacity-60', taskCardVariants({ status: task.status }))}>
      <CardContent className="flex flex-col p-4">
        <div className="flex w-full flex-row gap-1">
          <div className="-ml-0.5">
            <PrimaryLabelIcon label={task.primaryLabel} />
          </div>

          <TaskSummaryHtml html={task.summary} className="m-1 inline leading-none opacity-80" />
        </div>
        <TaskCardFooter task={task} isSheet={false} isSelected={false} />
      </CardContent>
    </Card>
  );
}
