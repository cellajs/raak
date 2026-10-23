import { UsersIcon } from 'lucide-react';
import { HighlightText } from '~/modules/common/match-highlight';
import { hiddenMatchReason } from '~/modules/task/helpers/match-reason';
import { useTaskSearchTerms } from '~/modules/task/hooks/use-task-search-terms';
import type { Task } from '~/modules/task/types';
import { cn } from '~/utils/cn';

interface TaskMatchReasonProps {
  task: Task;
  className?: string;
}

/** Where a task matched the search when its summary and labels show no term. */
export function TaskMatchReason({ task, className }: TaskMatchReasonProps) {
  const terms = useTaskSearchTerms();
  const reason = hiddenMatchReason(task, terms);
  if (!reason) return null;

  return (
    <div className={cn('flex flex-col gap-0.5 text-muted-foreground text-xs leading-tight', className)}>
      {reason.description && (
        <span>
          <HighlightText text={reason.description} />
        </span>
      )}
      {reason.people.length > 0 && (
        <span className="flex items-start gap-1.5">
          <UsersIcon className="mt-px size-3 shrink-0" />
          <span>
            <HighlightText text={reason.people.join(', ')} />
          </span>
        </span>
      )}
    </div>
  );
}
