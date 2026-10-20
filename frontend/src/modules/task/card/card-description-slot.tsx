import { type ReactNode, useEffect, useRef } from 'react';
import { DescriptionLayers } from '~/modules/common/blocknote/description-layers';
import { useDescriptionSlot } from '~/modules/common/blocknote/use-description-slot';
import { useMatchHighlight } from '~/modules/common/match-highlight';
import { TaskCardContentCollapsed } from '~/modules/task/card/card-content-collapsed';
import { TaskCardContentExpanded } from '~/modules/task/card/card-content-expanded';
import { DescriptionEditButton } from '~/modules/task/card/description-edit-button';
import { TaskUpdateForm } from '~/modules/task/card/task-update-form';
import type { Task } from '~/modules/task/types';

type SlotState = 'collapsed' | 'expanded' | 'editing';

/** A pointer passing over the board warms nothing: only a hover this long does. */
const warmHoverMs = 200;

/**
 * Paints the search terms over the expanded static or the editor; the collapsed summary paints its own. A component
 * of its own because the hook binds to the element present when it mounts.
 */
function PaintMatches({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useMatchHighlight(ref);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

/**
 * The task description in one place, with a single editor instance: the collapsed summary or the expanded static,
 * the editor warmed behind it on hover, and the live editor. Only the expanded static matches the editor's layout,
 * so only there does a click place the cursor at its point and leaving editing hold the editor until the static is
 * ready; the collapsed summary paints from the cache at once.
 */
export function CardDescriptionSlot({
  task,
  state,
  isReadOnly,
  animateClose = false,
  showDragHandle = false,
  onEditRequest,
}: {
  task: Task;
  state: SlotState;
  isReadOnly: boolean;
  animateClose?: boolean;
  showDragHandle?: boolean;
  /** Starts editing from the keyboard; set while editing may start. */
  onEditRequest?: () => void;
}) {
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

  return (
    <div className="relative">
      <DescriptionLayers
        slot={slot}
        // The static's checkbox is disabled and lets the pointer through to its wrapper, so the wrapper carries the cursor.
        className={isReadOnly ? '[&_.checklist-checkbox-wrapper]:cursor-not-allowed' : '[&_.checklist-checkbox-wrapper]:cursor-pointer'}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        staticView={
          state === 'collapsed' ? (
            <TaskCardContentCollapsed task={task} animateClose={animateClose} showDragHandle={showDragHandle} onEditRequest={onEditRequest} />
          ) : (
            <PaintMatches>
              <TaskCardContentExpanded task={task} descriptionOverride={slot.staticOverride} onReady={slot.onStaticReady} />
            </PaintMatches>
          )
        }
        editor={
          <PaintMatches>
            <TaskUpdateForm task={task} contentApiRef={slot.apiRef} onEditorReady={slot.onEditorReady} />
          </PaintMatches>
        }
      />
      {/* Frames the text inside taskDescriptionGutterStyle's padding, clear of the type button in the gutter. Outside the
          layers, whose click capture would take a key press for a cursor point. */}
      {onEditRequest && state === 'expanded' && (
        <DescriptionEditButton onClick={onEditRequest} className="-top-1 -right-2 bottom-3 left-0 sm:left-8" />
      )}
    </div>
  );
}
