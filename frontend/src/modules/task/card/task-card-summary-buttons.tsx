import { PaperclipIcon } from 'lucide-react';
import { env } from '~/env';
import type { Task } from '~/modules/task/types';

interface TaskCardSummaryButtonsProps {
  task: Task;
}

export function TaskCardSummaryButtons({ task }: TaskCardSummaryButtonsProps) {
  const attachmentsCount = task.attachments?.length ?? 0;

  const checkedCount = task.checkedCount ?? 0;
  const totalCount = task.checkboxCount ?? 0;

  return (
    <>
      <div className="-mt-[0.15rem] ml-1 inline-flex items-center gap-1">
        {task.expandable && <div className="inline-flex min-h-5 cursor-pointer text-muted-foreground text-sm">...</div>}
        {totalCount > 0 && (
          <div className="inline-flex min-h-5 cursor-pointer gap-[.15rem] text-sm">
            <span className="text-success">{checkedCount}</span>
            <span className="text-muted-foreground">/</span>
            <span>{totalCount}</span>
          </div>
        )}
        {attachmentsCount > 0 && (
          <div className="inline-flex cursor-pointer items-center text-sm">
            <PaperclipIcon className="size-2.5 -rotate-45 transition-transform" />
            <span>{attachmentsCount}</span>
          </div>
        )}
      </div>
      {env.VITE_DEBUG_UI && <span className="ml-2 text-center text-muted-foreground/50 text-sm">#{task.displayOrder}</span>}
    </>
  );
}
