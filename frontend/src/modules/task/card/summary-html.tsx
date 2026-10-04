import { Suspense, useId } from 'react';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import type { Task } from '~/modules/task/types';

type TaskSummaryHtmlProps = { task: Pick<Task, 'summary' | 'tenantId' | 'organizationId'>; className?: string };

/** Renders a task's summary, a one-block BlockNote document, with the static description pipeline. */
export function TaskSummaryHtml({ task, className }: TaskSummaryHtmlProps) {
  const id = useId();
  if (!task.summary) return null;

  return (
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
  );
}
