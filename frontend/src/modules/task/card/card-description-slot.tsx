import { useEffect, useRef, useState } from 'react';
import type { BlockNoteContentApi } from '~/modules/common/blocknote/blocknote-editor';
import { TaskCardContentCollapsed } from '~/modules/task/card/card-content-collapsed';
import { TaskCardContentExpanded } from '~/modules/task/card/card-content-expanded';
import { TaskUpdateForm } from '~/modules/task/card/task-update-form';
import type { Task } from '~/modules/task/types';

type SlotState = 'collapsed' | 'expanded' | 'editing';

const WARM_HOVER_MS = 200;

/**
 * Owns the task description across its whole lifecycle in one place, with a single editor instance:
 * - Renders the collapsed summary / expanded static HTML / live editor per `state`.
 * - Warms the editor on sustained hover (invisible overlay pinned to the static's box, so it never
 *   shifts layout), so a click promotes it in place: no blink, no Yjs reconnect, cursor at the click
 *   (expanded, where layout matches the static) or at the end (collapsed).
 * - On leaving edit, keeps the editor until the static is ready and renders the static from the
 *   editor's just-committed content (no cache/SSE race).
 * - Toggles checklist items through the same editor (consistent Yjs path), queued if not yet warm.
 */
export function CardDescriptionSlot({
  task,
  state,
  isReadOnly,
}: {
  task: Task;
  state: SlotState;
  isReadOnly: boolean;
}) {
  const editing = state === 'editing';

  const [warm, setWarm] = useState(false);
  const [holdEditor, setHoldEditor] = useState(false);
  const [committed, setCommitted] = useState<string>();

  const apiRef = useRef<BlockNoteContentApi | null>(null);
  const prevState = useRef<SlotState>(state);
  const hoveringRef = useRef(false);
  const warmTimer = useRef(0);
  const pendingCursor = useRef<{ x: number; y: number; map: boolean } | null>(null);
  const pendingToggle = useRef<string | null>(null);

  // Transition handling during render so the editor is never unmounted for an intermediate frame.
  if (prevState.current !== state) {
    const prev = prevState.current;
    prevState.current = state;
    if (editing) {
      setCommitted(undefined);
      setHoldEditor(false);
    } else if (prev === 'editing' && state === 'expanded') {
      // Hand off to the expanded static view: keep the outgoing editor and seed the static with its
      // just-committed content until onReady releases the hold, so the swap has no blink or reflow.
      const latest = apiRef.current?.getContent();
      if (latest) setCommitted(latest);
      setHoldEditor(true);
    }
    // editing -> collapsed needs no hold: the cached summary paints instantly, so holding would only
    // keep the heavy collaborative editor on screen for the safety-net timer with nothing to wait for.
  }

  // Safety net: never hold the outgoing editor indefinitely.
  useEffect(() => {
    if (!holdEditor) return;
    const timer = window.setTimeout(() => setHoldEditor(false), 250);
    return () => clearTimeout(timer);
  }, [holdEditor]);

  const flushCursor = () => {
    const p = pendingCursor.current;
    const api = apiRef.current;
    if (!p || !api) return;
    pendingCursor.current = null;
    if (p.map) api.placeCursorAtPoint(p.x, p.y);
    else api.focusSummaryEnd();
  };

  const flushToggle = () => {
    const id = pendingToggle.current;
    const api = apiRef.current;
    if (!id || !api) return;
    pendingToggle.current = null;
    if (api.toggleChecklist(id)) {
      const latest = api.getContent();
      if (latest) setCommitted(latest); // reflect the toggle in the static immediately
    }
    if (!hoveringRef.current) setWarm(false);
  };

  // Place the cursor once we enter editing and the editor is present.
  useEffect(() => {
    if (state !== 'editing') return;
    const raf = requestAnimationFrame(flushCursor);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const handleEditorReady = () => {
    flushToggle();
    flushCursor();
  };

  const handleMouseEnter = () => {
    hoveringRef.current = true;
    if (editing) return;
    clearTimeout(warmTimer.current);
    warmTimer.current = window.setTimeout(() => setWarm(true), WARM_HOVER_MS);
  };

  const handleMouseLeave = () => {
    hoveringRef.current = false;
    clearTimeout(warmTimer.current);
    if (!pendingToggle.current) setWarm(false); // keep warm until a queued toggle can flush
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (editing || isReadOnly) return;
    const target = event.target as HTMLElement;

    // Checklist: toggle through the editor (consistent Yjs path) only when the actual checkbox is
    // clicked (its wrapper), not the item text, so the sentence stays clickable to edit.
    const checkboxId = target
      .closest('.checklist-checkbox-wrapper')
      ?.querySelector<HTMLInputElement>('input.checklist-checkbox')?.dataset.checkboxId;
    if (checkboxId) {
      event.preventDefault();
      event.stopPropagation(); // do not let the card enter editing
      pendingToggle.current = checkboxId;
      if (apiRef.current) flushToggle();
      else setWarm(true);
      return;
    }

    // Text click: stash the point so the cursor lands there once editing begins (card handles the state change).
    pendingCursor.current = { x: event.clientX, y: event.clientY, map: state === 'expanded' };
  };

  const editorMounted = warm || editing || holdEditor;
  const editorInFlow = editing || holdEditor;
  const showBase = !editing;

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClickCapture={handleClickCapture}
    >
      {showBase && (
        <div className={holdEditor ? 'invisible absolute inset-0' : ''}>
          {state === 'collapsed' ? (
            <TaskCardContentCollapsed task={task} />
          ) : (
            <TaskCardContentExpanded task={task} descriptionOverride={committed} onReady={() => setHoldEditor(false)} />
          )}
        </div>
      )}
      {editorMounted && (
        <div className={editorInFlow ? '' : 'invisible absolute inset-0 overflow-hidden'}>
          <TaskUpdateForm task={task} active={editing} contentApiRef={apiRef} onEditorReady={handleEditorReady} />
        </div>
      )}
    </div>
  );
}
