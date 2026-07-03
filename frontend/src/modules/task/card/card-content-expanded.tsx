import { Suspense } from 'react';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { Spinner } from '~/modules/common/spinner';
import type { Task } from '~/modules/task/types';

const expandedStyle = '[&>.bn-static-editor]:min-h-8 w-full bg-transparent border-none pl-1 sm:pl-9 pb-4';

interface TaskCardContentExpandedProps {
  task: Task;
}

/**
 * Renders the task description as static HTML in the expanded (non-editing) state.
 *
 * Note: we intentionally do NOT apply `inert` here even in read-only mode — `inert` blocks
 * text selection in the entire subtree, preventing read-only users from copying the description.
 */
export function TaskCardContentExpanded({ task }: TaskCardContentExpandedProps) {
  const { tenantId } = useOrganizationLayoutContext();

  if (!task.description) return null;

  return (
    <Suspense fallback={<Spinner className="my-4 h-6 w-6 opacity-50" noDelay />}>
      <BlockNoteFullHtml
        id={`blocknote-${task.id}`}
        defaultValue={task.description}
        className={expandedStyle}
        dense
        clickOpensPreview
        tenantId={tenantId}
        organizationId={task.organizationId}
      />
    </Suspense>
  );
}
