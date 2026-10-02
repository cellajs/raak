import { Suspense, useId } from 'react';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import type { Task } from '~/modules/task/types';
import { cn } from '~/utils/cn';

// The block wrappers drop out of the layout, so the summary's text flows inline with what follows it.
const inlineBlockStyle =
  '[&>.bn-static-editor]:contents [&_.bn-block-group]:contents [&_.bn-block-outer]:contents [&_.bn-block]:contents [&_.bn-block-content]:contents';

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
        className={cn(inlineBlockStyle, className)}
        dense
        tenantId={task.tenantId}
        organizationId={task.organizationId}
      />
    </Suspense>
  );
}
