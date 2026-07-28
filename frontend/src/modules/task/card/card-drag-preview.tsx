import { BlockNoteMinimalHtml } from '~/modules/common/blocknote/minimal-html';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { TaskCardFooter } from '~/modules/task/card/card-footer';
import { taskCardVariants } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { Card, CardContent } from '~/modules/ui/card';
import { cn } from '~/utils/cn';

/** A primitive card component for displaying task information during drag operations */
export const TaskCardDragPreview = ({ task }: { task: Task }) => {
  return (
    <Card
      tabIndex={0}
      className={cn(
        'is-collapsed rounded-none border bg-card/50 opacity-60',
        taskCardVariants({ status: task.status }),
      )}
    >
      <CardContent className="space-between flex flex-col p-4">
        <div className="flex w-full flex-row gap-1">
          <div className="-ml-0.5">
            <PrimaryLabelIcon label={task.primaryLabel} />
          </div>

          <BlockNoteMinimalHtml html={task.summary} className="m-1 inline leading-none opacity-80" />
        </div>
        <TaskCardFooter task={task} isSheet={false} isSelected={false} />
      </CardContent>
    </Card>
  );
};
