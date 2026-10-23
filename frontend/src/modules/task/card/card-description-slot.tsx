import { type ReactNode, useEffect, useRef } from 'react';
import { DescriptionLayers } from '~/modules/common/blocknote/description-layers';
import { useDescriptionSlot } from '~/modules/common/blocknote/use-description-slot';
import { useMatchHighlight } from '~/modules/common/match-highlight/use-match-highlight';
import { DescriptionEditButton } from '~/modules/task/card/description-edit-button';
import { TaskCardContentCollapsed } from '~/modules/task/card/task-card-content-collapsed';
import { TaskCardContentExpanded } from '~/modules/task/card/task-card-content-expanded';
import { TaskUpdateForm } from '~/modules/task/card/task-update-form';
import type { Task, TaskState } from '~/modules/task/types';

/** A pointer passing over the board warms nothing: only a hover this long does. */
const warmHoverMs = 200;

interface PaintMatchesProps {
  children: ReactNode;
}

// The hook binds to the element present at mount, so each layer gets its own. The collapsed summary paints its own matches.
function PaintMatches({ children }: PaintMatchesProps) {
  const ref = useRef<HTMLDivElement>(null);
  useMatchHighlight(ref);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

interface CardDescriptionSlotProps {
  task: Task;
  state: TaskState;
  isReadOnly: boolean;
  animateClose?: boolean;
  showDragHandle?: boolean;
  /** Starts editing from the keyboard; set while editing may start. */
  onEditRequest?: () => void;
}

/** Collapsed summary, expanded static and live editor over one editor instance, warmed behind them on hover. */
export function CardDescriptionSlot({
  task,
  state,
  isReadOnly,
  animateClose = false,
  showDragHandle = false,
  onEditRequest,
}: CardDescriptionSlotProps) {
  // Only the expanded static matches the editor's layout: a click places the cursor at its point, and leaving editing holds the editor.
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
      {/* Frames the text inside taskDescriptionGutterClass's padding, clear of the type button in the gutter. Outside the
          layers, whose click capture would take a key press for a cursor point. */}
      {onEditRequest && state === 'expanded' && (
        <DescriptionEditButton onClick={onEditRequest} className="-top-1 -right-2 bottom-3 left-0 sm:left-8" />
      )}
    </div>
  );
}
