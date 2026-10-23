import { Suspense } from 'react';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';
import { Spinner } from '~/modules/common/spinner';
import { taskDescriptionGutterClass } from '~/modules/task/task-styles';
import type { Task } from '~/modules/task/types';
import { cn } from '~/utils/cn';
import { tw } from '~/utils/tw';

const staticEditorClass = tw('w-full border-none bg-transparent [&>.bn-static-editor]:min-h-8');

interface TaskCardContentExpandedProps {
  task: Task;
  /** Drops the description gutter when a wrapper already applies `taskDescriptionGutterClass`, so it is not doubled. */
  noGutter?: boolean;
  /** Fires once the static description HTML is computed, letting the parent defer the edit->static swap. */
  onReady?: () => void;
  /** Replaces `task.description` with the editor's just-committed content, so the edit->static swap paints before the cache settles. */
  descriptionOverride?: string;
}

/** The task description as static HTML. Never `inert`, which would block text selection for read-only users. */
export function TaskCardContentExpanded({ task, noGutter, onReady, descriptionOverride }: TaskCardContentExpandedProps) {
  const { tenantId } = useOrganizationLayoutContext();

  const description = descriptionOverride ?? task.description;
  if (!description) return null;

  return (
    <Suspense fallback={<Spinner className="my-4" noDelay />}>
      <BlockNoteFullHtml
        id={`blocknote-${task.id}`}
        defaultValue={description}
        className={cn(staticEditorClass, !noGutter && taskDescriptionGutterClass)}
        dense
        clickOpensPreview
        tenantId={tenantId}
        organizationId={task.organizationId}
        onReady={onReady}
      />
    </Suspense>
  );
}
