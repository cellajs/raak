import { Suspense, useId, useRef } from 'react';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { useMatchHighlight } from '~/modules/common/match-highlight';
import type { Task } from '~/modules/task/types';

interface TaskSummaryHtmlProps {
  task: Pick<Task, 'summary' | 'tenantId' | 'organizationId'>;
  className?: string;
}

/** Renders a task's summary, a one-block BlockNote document, with the static description pipeline, search matches painted over it. */
export function TaskSummaryHtml({ task, className }: TaskSummaryHtmlProps) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useMatchHighlight(ref);
  if (!task.summary) return null;

  return (
    <span ref={ref} className="contents">
      <Suspense fallback={null}>
        <BlockNoteFullHtml
          id={id}
          defaultValue={task.summary}
          className={className}
          dense
          inline
          tenantId={task.tenantId}
          organizationId={task.organizationId}
        />
      </Suspense>
    </span>
  );
}
