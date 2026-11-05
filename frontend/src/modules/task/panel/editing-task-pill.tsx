import { ArrowDownIcon, ArrowUpIcon, Maximize2Icon, XIcon } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VirtualizerHandle } from 'virtua';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { openTaskSheet } from '~/modules/task/helpers/board-navigation';
import { productRef } from '~/modules/task/helpers/product-ref';
import type { Task } from '~/modules/task/types';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { Separator } from '~/modules/ui/separator';
import { cn } from '~/utils/cn';
import { isTouchInteraction } from '~/utils/input-modality';

type Edge = 'top' | 'bottom';
type ListHandle = Pick<VirtualizerHandle, 'scrollOffset' | 'findItemIndex' | 'scrollToIndex'>;

// A card showing less than this is out of view: a sliver at the edge doesn't show where the caret is
const visibleMin = 24;
const remountFrames = 10;

// Tiptap puts its editor on the editable element (TiptapEditorHTMLElement): the one handle on the caret from outside the card
interface EditorElement extends HTMLElement {
  editor?: { view: { focus: () => void; coordsAtPos: (pos: number) => { top: number }; state: { selection: { head: number } } } };
}

const stackOffset = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  return (
    (Number.parseFloat(style.getPropertyValue('--sticky-stack-nav')) || 0) + (Number.parseFloat(style.getPropertyValue('--sticky-stack-pin')) || 0)
  );
};

interface UseOffViewEdgeOptions {
  taskId: string;
  index: number;
  anchorRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  windowMode: boolean;
  listRef: RefObject<ListHandle | null>;
}

/** The edge of the panel's view the card has left by, or null while it is in view. */
function useOffViewEdge({ taskId, index, anchorRef, scrollRef, windowMode, listRef }: UseOffViewEdgeOptions) {
  const [edge, setEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const viewport = windowMode ? null : scrollRef.current;
    const pending = { frame: 0 };

    const measure = () => {
      pending.frame = 0;
      const card = document.getElementById(taskId);
      if (card && (!viewport || viewport.contains(card))) {
        const rect = card.getBoundingClientRect();
        const view = viewport
          ? viewport.getBoundingClientRect()
          : { top: anchorRef.current ? stackOffset(anchorRef.current) : 0, bottom: window.innerHeight };
        setEdge(rect.bottom < view.top + visibleMin ? 'top' : rect.top > view.bottom - visibleMin ? 'bottom' : null);
        return;
      }
      // An unmounted row lies well outside the view: the first row in view tells which side
      const list = listRef.current;
      setEdge(list ? (index < list.findItemIndex(list.scrollOffset) ? 'top' : 'bottom') : null);
    };
    const schedule = () => {
      if (!pending.frame) pending.frame = requestAnimationFrame(measure);
    };

    const target = viewport ?? window;
    target.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      target.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(pending.frame);
    };
  }, [taskId, index, anchorRef, scrollRef, windowMode, listRef]);

  return edge;
}

interface EditingTaskPillProps {
  /** The panel's card in edit mode. */
  task: Task;
  index: number;
  scrollRef: RefObject<HTMLElement | null>;
  /** Scrolls the window when true, else the `scrollRef` viewport. */
  windowMode: boolean;
  listRef: RefObject<ListHandle | null>;
}

/** Floats at the edge of a panel's view while its card in edit mode is out of view: back to the card, open it in the sheet, or stop editing. */
export function EditingTaskPill({ task, index, scrollRef, windowMode, listRef }: EditingTaskPillProps) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const edge = useOffViewEdge({ taskId: task.id, index, anchorRef, scrollRef, windowMode, listRef });

  // Fading out, the pill stays at the edge it showed on
  const [shownEdge, setShownEdge] = useState<Edge>('bottom');
  if (edge && edge !== shownEdge) setShownEdge(edge);

  const ref = productRef(task.number);

  const returnToCard = (framesLeft = remountFrames) => {
    const card = document.getElementById(task.id);
    if (!card) {
      if (framesLeft === remountFrames) listRef.current?.scrollToIndex(index, { align: 'center' });
      if (framesLeft > 0) requestAnimationFrame(() => returnToCard(framesLeft - 1));
      return;
    }

    const view = card.querySelector<EditorElement>('.ProseMirror[contenteditable="true"]')?.editor?.view;
    const caretTop = view ? view.coordsAtPos(view.state.selection.head).top : card.getBoundingClientRect().top;
    const viewport = windowMode ? null : scrollRef.current;
    const { top, height } = viewport ? viewport.getBoundingClientRect() : { top: 0, height: window.innerHeight };
    (viewport ?? window).scrollBy({ top: caretTop - (top + height / 2), behavior: 'smooth' });
    // A touch focus would raise the on-screen keyboard unasked: the caret waits for a tap in the text
    if (!isTouchInteraction()) view?.focus();
  };

  const tooltipSide = shownEdge === 'top' ? 'bottom' : 'top';

  return (
    <div
      ref={anchorRef}
      className={cn(
        'pointer-events-none inset-x-0 z-30 flex justify-center',
        // An on-screen keyboard pans the page under fixed UI, and the selection bar takes the bottom of the screen
        'group-[.keyboard-open]/body:hidden group-[.selection-active]/body:hidden',
        windowMode ? 'fixed' : 'absolute',
        shownEdge === 'top' && (windowMode ? 'top-[calc(var(--sticky-stack-nav)+var(--sticky-stack-pin,0px)+0.75rem)]' : 'top-3'),
        // On a phone it sits above the floating buttons: at the top of the page the add button's label fills the room between them
        shownEdge === 'bottom' && (windowMode ? 'bottom-[calc(5.5rem+var(--bottom-inset,0px))]' : 'bottom-3'),
      )}
    >
      <div
        inert={!edge}
        className={cn(
          'flex h-8 items-center rounded-full bg-background shadow-floating transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none',
          edge ? 'pointer-events-auto' : cn('opacity-0', shownEdge === 'top' ? '-translate-y-1.5' : 'translate-y-1.5'),
        )}
      >
        <TooltipButton toolTipContent={t('c:back_to_task')} side={tooltipSide}>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-r-none rounded-l-full pr-2 pl-3" onClick={() => returnToCard()}>
            {shownEdge === 'top' ? <ArrowUpIcon /> : <ArrowDownIcon />}
            {t('c:editing')}
            {ref && (
              <Badge variant="secondary" className="pl-1.5 font-normal text-muted-foreground tabular-nums">
                {ref}
              </Badge>
            )}
          </Button>
        </TooltipButton>
        <Separator orientation="vertical" className="bg-input data-vertical:h-4" />
        <TooltipButton toolTipContent={t('c:expand')} side={tooltipSide}>
          <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={() => openTaskSheet(task.id)} aria-label={t('c:expand')}>
            <Maximize2Icon />
          </Button>
        </TooltipButton>
        <TooltipButton toolTipContent={t('c:stop_editing')} side={tooltipSide}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-r-full rounded-l-none"
            onClick={() => taskCardStore.getState().setTaskState(task.id, 'expanded')}
            aria-label={t('c:stop_editing')}
          >
            <XIcon />
          </Button>
        </TooltipButton>
      </div>
    </div>
  );
}
