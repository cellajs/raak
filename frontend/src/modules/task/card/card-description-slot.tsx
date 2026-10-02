import { useEffect, useRef } from 'react';
import { DescriptionLayers } from '~/modules/common/blocknote/description-layers';
import { useDescriptionSlot } from '~/modules/common/blocknote/use-description-slot';
import { TaskCardContentCollapsed } from '~/modules/task/card/card-content-collapsed';
import { TaskCardContentExpanded } from '~/modules/task/card/card-content-expanded';
import { TaskUpdateForm } from '~/modules/task/card/task-update-form';
import type { Task } from '~/modules/task/types';

type SlotState = 'collapsed' | 'expanded' | 'editing';

/** A pointer passing over the board warms nothing: only a hover this long does. */
const warmHoverMs = 200;

/**
 * The task description in one place, with a single editor instance: the collapsed summary or the expanded static,
 * the editor warmed behind it on hover, and the live editor. Only the expanded static matches the editor's layout,
 * so only there does a click place the cursor at its point and leaving editing hold the editor until the static is
 * ready; the collapsed summary paints from the cache at once.
 */
export function CardDescriptionSlot({ task, state, isReadOnly }: { task: Task; state: SlotState; isReadOnly: boolean }) {
  const slot = useDescriptionSlot({
    editing: state === 'editing',
    canEdit: !isReadOnly,
    description: task.description,
    holdOnExit: state === 'expanded',
    cursorAtPoint: state === 'expanded',
  });

  const warmTimer = useRef(0);
  useEffect(() => () => clearTimeout(warmTimer.current), []);

  const handleMouseEnter = () => {
    clearTimeout(warmTimer.current);
    warmTimer.current = window.setTimeout(() => slot.warm('hover'), warmHoverMs);
  };

  const handleMouseLeave = () => {
    clearTimeout(warmTimer.current);
    slot.cool('hover');
  };

  // A frame later: dev StrictMode remounts the editor view after its ready effect, which would drop the cursor.
  const handleEditorReady = () => requestAnimationFrame(slot.onEditorReady);

  return (
    <DescriptionLayers
      slot={slot}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      staticView={
        state === 'collapsed' ? (
          <TaskCardContentCollapsed task={task} />
        ) : (
          <TaskCardContentExpanded task={task} descriptionOverride={slot.staticOverride} onReady={slot.onStaticReady} />
        )
      }
      editor={<TaskUpdateForm task={task} contentApiRef={slot.apiRef} onEditorReady={handleEditorReady} />}
    />
  );
}
