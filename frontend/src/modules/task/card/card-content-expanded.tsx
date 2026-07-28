import { Suspense } from 'react';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { Spinner } from '~/modules/common/spinner';
import { taskDescriptionGutterStyle } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';

const staticEditorBase = '[&>.bn-static-editor]:min-h-8 w-full bg-transparent border-none';
const expandedStyle = `${staticEditorBase} ${taskDescriptionGutterStyle}`;

interface TaskCardContentExpandedProps {
  task: Task;
  /**
   * Drop the description gutter. Set when this preview is nested inside a wrapper that already
   * applies `taskDescriptionGutterStyle` (the edit form's waiting-fallback), so the gutter isn't
   * doubled and the preview lines up pixel-for-pixel with the editor that replaces it.
   */
  noGutter?: boolean;
}

/**
 * Renders the task description as static HTML in the expanded (non-editing) state.
 *
 * We intentionally do NOT apply `inert` here even in read-only mode. `inert` blocks
 * text selection in the entire subtree, preventing read-only users from copying the description.
 */
export function TaskCardContentExpanded({ task, noGutter }: TaskCardContentExpandedProps) {
  const { tenantId } = useOrganizationLayoutContext();

  if (!task.description) return null;

  return (
    <Suspense fallback={<Spinner className="my-4 h-6 w-6 opacity-50" noDelay />}>
      <BlockNoteFullHtml
        id={`blocknote-${task.id}`}
        defaultValue={task.description}
        className={noGutter ? staticEditorBase : expandedStyle}
        dense
        clickOpensPreview
        tenantId={tenantId}
        organizationId={task.organizationId}
      />
    </Suspense>
  );
}
