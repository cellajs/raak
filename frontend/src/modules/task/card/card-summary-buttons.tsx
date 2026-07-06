import { PaperclipIcon } from 'lucide-react';
import { env } from '~/env';
import type { Task } from '~/modules/task/types';

/**
 * SummaryButtons component displays a concise overview of a task's details, such as the number of checklist items completed and total, as well as the count of media attachments. It also indicates if the task has expandable content. This component is designed to be shown on task cards in a compact form, providing quick insights without needing to open the task details.
 */
export const TaskCardSummaryButtons = ({ item }: { item: Task }) => {
  const attachmentsCount = item.attachmentCount ?? 0;

  const checkedCount = item.checkedCount ?? 0;
  const totalCount = item.checkboxCount ?? 0;

  return (
    <>
      {
        <div className="mt-[-0.15rem] ml-1 inline-flex items-center gap-1 opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100 group-data-sheet/task:opacity-100">
          {item.expandable && <div className="inline-flex h-5 cursor-pointer py-0 text-sm">...</div>}
          {totalCount > 0 && (
            <div className="inline-flex h-5 cursor-pointer gap-[.15rem] text-sm">
              <span className="text-success">{checkedCount}</span>
              <span className="opacity-50">/</span>
              <span className="">{totalCount}</span>
            </div>
          )}
          {attachmentsCount > 0 && (
            <div className="inline-flex cursor-pointer items-center text-sm">
              <PaperclipIcon size={10} className="-rotate-45 transition-transform" />
              <span className="">{attachmentsCount}</span>
            </div>
          )}
        </div>
      }
      {/*  in debug mode: show order number to debug drag */}
      {env.VITE_DEBUG_UI && <span className="ml-2 text-center text-sm opacity-15">#{item.displayOrder}</span>}
    </>
  );
};
