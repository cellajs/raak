import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { GripVerticalIcon, PlusIcon } from 'lucide-react';
import { AnimatePresence, cancelFrame, frame, motion } from 'motion/react';
import { type FocusEvent, type KeyboardEvent, type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelName } from 'shared/config/labels-config';
import { DropIndicator } from '~/modules/common/drop-indicator';
import { HighlightText } from '~/modules/common/match-highlight/highlight-text';
import { ReorderHandle, type ReorderPosition } from '~/modules/common/reorder-handle/reorder-handle';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { type EpicProgress, epicTotal, noEpicProgress } from '~/modules/label/epic-progress';
import { openEpicProjectsPicker } from '~/modules/label/epic-projects';
import { LabelFilterCount } from '~/modules/label/label-filter-count';
import { LabelOptionsButton } from '~/modules/label/label-options-button';
import { isLabelData, labelDragData } from '~/modules/label/label-order';
import { LabelTileDetails } from '~/modules/label/label-tile-details';
import { labelTileReveal } from '~/modules/label/label-tile-reveal';
import { labelTileStore, useLabelTileStore } from '~/modules/label/label-tile-store';
import { useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow, LabelsHostProps } from '~/modules/label/types';
import { boardFocusStore, useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { CardCloseButton } from '~/modules/task/card/card-close-button';
import { gripFoldClass } from '~/modules/task/card/task-drag-handle';
import { toggleLabelFilter } from '~/modules/task/helpers/board-navigation';
import { focusItem, markCurrentItemMounted, setCurrentItem, takePendingFocus } from '~/modules/task/helpers/focus-item';
import { useItemControlsTabOrder } from '~/modules/task/hooks/use-item-controls-tab-order';
import { epicProgressColors, itemFocusBarClass } from '~/modules/task/task-styles';
import { buttonVariants } from '~/modules/ui/button';
import { Input } from '~/modules/ui/input';
import { cn } from '~/utils/cn';
import { isHoverContentOpen } from '~/utils/is-hover-content-open';
import { getScrollParent } from '~/utils/scroll-parent';
import { tw } from '~/utils/tw';

// Like a task card's actions: on a collapsed tile hidden until it is hovered or holds focus, then each slides in from the right
// like the close button; an open tile shows them throughout. On a collapsed epic pointer events follow, so a tap lands on the
// tile and opens it. Focus from a tap must not reveal there: the buttons would appear under the finger between press and
// release, and the browser then fires no click.
const actionSlide = tw(
  'translate-x-3 opacity-0 transition-[translate,opacity,color,background-color] duration-200 ease-out motion-reduce:transition-none',
);
const restingActionsReveal = tw(
  'group-hover/label-tile:translate-x-0 group-hover/label-tile:opacity-100 group-focus-visible/label-tile:translate-x-0 group-focus-visible/label-tile:opacity-100 group-has-data-dropdowner-active/label-tile:translate-x-0 group-has-data-dropdowner-active/label-tile:opacity-100 group-has-data-dropdowner-done/label-tile:translate-x-0 group-has-data-dropdowner-done/label-tile:opacity-100 group-has-[:focus-visible]/label-tile:translate-x-0 group-has-[:focus-visible]/label-tile:opacity-100',
);
const restingActionsPointer = tw(
  'pointer-events-none group-hover/label-tile:pointer-events-auto group-focus-visible/label-tile:pointer-events-auto group-has-[:focus-visible]/label-tile:pointer-events-auto has-data-dropdowner-active:pointer-events-auto has-data-dropdowner-done:pointer-events-auto',
);
// A tag never opens, so a touch screen, which has no hover, shows its actions at rest
const touchAtRest = tw('pointer-coarse:pointer-events-auto pointer-coarse:translate-x-0 pointer-coarse:opacity-100');

/** Holds a tile where it is while the open one above it collapses. Scroll anchoring would, but a sticky panel turns it off and Safari has none. */
const holdTileInPlace = (tile: HTMLElement) => {
  const top = tile.getBoundingClientRect().top;
  const scrollParent = getScrollParent(tile);
  const end = performance.now() + labelTileReveal.transition.duration * 1000 + 50;
  // After motion's render: earlier, each correction would lag the collapse by a frame
  const hold = () => {
    const shift = tile.getBoundingClientRect().top - top;
    if (shift) scrollParent.scrollBy({ top: shift, behavior: 'instant' });
    if (performance.now() >= end) cancelFrame(hold);
  };
  frame.postRender(hold, true);
};

/** A closed epic's progress behind its row: Done from the end, In progress before it, To do left bare. A line along the bottom repeats both at full strength. */
function EpicTint({ progress }: { progress: EpicProgress }) {
  const total = epicTotal(progress);
  if (!total) return null;
  const line = tw('after:absolute after:inset-x-0 after:-bottom-px after:h-0.5');
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex justify-end">
      {(['inProgress', 'done'] as const).map((part) => (
        <span
          key={part}
          className={cn('relative h-full', line, epicProgressColors[part].tint, epicProgressColors[part].line)}
          style={{ width: `${(progress[part] / total) * 100}%` }}
        />
      ))}
    </span>
  );
}

interface LabelTileProps extends Pick<LabelsHostProps, 'onAction'> {
  row: LabelRow;
  /** An epic's progress; a tag shows none. */
  progress?: EpicProgress;
  /** Its read-only projects, by a guest membership or public access. Any one locks the whole label, as a rename or delete acts on all its projects. */
  lockedByProjectIds: string[];
  /** A tile in the board panel is a board item: one Tab stop for the list, arrow keys between tiles. */
  onBoard?: boolean;
  /** On a workspace: the projects a label can live in, for picking an epic's projects. */
  scopeProjectIds?: string[];
  /** Its place in the list, when a drag or an arrow press on its grip can move it. */
  position?: ReorderPosition;
  onMove?: (step: -1 | 1) => void;
}

/** DOM id of a label tile, so a label link can scroll its tile into view. */
export const labelTileDomId = (groupKey: string) => `label-tile-${groupKey}`;

/** An epic opens in place like a task card; a click on a tag filters the board by it. Either renames through its ⋮ menu. */
export function LabelTile({
  row,
  progress = noEpicProgress,
  lockedByProjectIds,
  onAction,
  onBoard,
  scopeProjectIds,
  position,
  onMove,
}: LabelTileProps) {
  const { t } = useTranslation();

  const isEpic = row.mode === 'epic';
  // Only an epic opens: a tile closed as an epic while open shows as the tag it became
  const expanded = useLabelTileStore((state) => state.expandedId === row.groupKey) && isEpic;
  const isReadOnly = lockedByProjectIds.length > 0;

  const updateLabel = useLabelUpdateMutation(row.tenantId, row.organizationId);
  const [editingName, setEditingName] = useState<string | null>(null);

  const domId = labelTileDomId(row.groupKey);
  const isCurrent = useBoardFocusStore((state) => state.currentItemId === domId);
  const tileRef = useRef<HTMLDivElement>(null);
  // Off the board (the mobile drawer) a tile keeps its controls in the Tab order. On it, as with a task card, a collapsed
  // epic is one Tab stop: Enter opens it, and only then does Tab reach its controls, cycling inside it. A tag never opens,
  // so its controls follow it in the Tab order while it is current.
  useItemControlsTabOrder(tileRef, domId, onBoard ? isCurrent && (expanded || !isEpic) : true, { trap: onBoard && expanded });

  const [nameHandle, setNameHandle] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const canReorder = !!onBoard && !isReadOnly && !!position;

  // A collapsed tile drags as a whole, as a task card does; an open one by its name, so its fields keep text selection. A rename unmounts the name and with it the handle.
  useEffect(() => {
    const element = tileRef.current;
    const dragHandle = expanded ? nameHandle : element;
    if (!canReorder || !element || !dragHandle) return;
    return draggable({
      element,
      dragHandle,
      getInitialData: () => labelDragData(row.id),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [canReorder, expanded, nameHandle, row.id]);

  // As on a task card the grip is for the keyboard only, folded away until it has focus
  const [gripHasFocus, setGripHasFocus] = useState(false);
  const pendingIndexRef = useRef<number | null>(null);
  const moveByKey = (step: -1 | 1) => {
    if (!position || !onMove) return;
    pendingIndexRef.current = position.index + step;
    onMove(step);
  };
  // Runs after the grip's own effect has focused it again in its new place
  useLayoutEffect(() => {
    if (pendingIndexRef.current === position?.index) pendingIndexRef.current = null;
  });
  // The blur of a re-inserted tile has no next target: the grip stays unfolded through the move
  const handleGripBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.relatedTarget && pendingIndexRef.current !== null) return;
    setGripHasFocus(false);
  };

  useEffect(() => {
    const element = tileRef.current;
    if (!onBoard || !element) return;
    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isLabelData(source.data) && source.data.id !== row.id,
      getIsSticky: () => true,
      getData: ({ input }) => attachClosestEdge(labelDragData(row.id), { element, input, allowedEdges: ['top', 'bottom'] }),
      onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });
  }, [onBoard, row.id]);

  // Mounting as the current tile: take the focus a keypress left for it, and hold the list's Tab stop
  useEffect(() => {
    if (!onBoard || !isCurrent) return;
    takePendingFocus(domId, tileRef.current);
    return markCurrentItemMounted(domId);
  }, [onBoard, isCurrent, domId]);

  // A closed name spans the tile: a click on it focuses the tile, as on a task card, so the arrow keys go on from it
  const handleNameClick = () => {
    if (onBoard) focusItem(domId);
    if (!isEpic) {
      toggleLabelFilter(row.slug);
      onAction?.();
      return;
    }
    if (tileRef.current && labelTileStore.getState().expandedId) holdTileInPlace(tileRef.current);
    labelTileStore.getState().expand(row.groupKey);
  };

  // A tag in several projects asks which become the epic; one in a single project becomes it at once, its tint growing in
  const handleMakeEpic = (event: MouseEvent<HTMLButtonElement>) => {
    if (row.projectIds.length > 1 && scopeProjectIds) {
      openEpicProjectsPicker(event.currentTarget, `make-epic-${row.groupKey}`, {
        template: row,
        mode: 'make',
        scopeProjectIds,
        usage: row.projectUsage,
      });
      return;
    }
    for (const id of row.siblingIds) updateLabel.mutate({ id, ops: { mode: 'epic' } });
  };

  // Back to the tile after a keyboard rename, once the field has unmounted: blurring it first would commit again
  const refocusTile = () => {
    if (onBoard) requestAnimationFrame(() => tileRef.current?.focus());
  };

  const collapse = () => labelTileStore.getState().collapse(row.groupKey);
  const actionClass = cn(actionSlide, expanded ? 'translate-x-0 opacity-100' : [restingActionsReveal, !isEpic && touchAtRest]);

  const handleTileFocus = () => {
    if (onBoard && boardFocusStore.getState().currentItemId !== domId) setCurrentItem(domId);
  };

  // On the tile itself, as on a task card: Enter opens an epic or filters by a tag, Escape closes an epic and keeps focus on it.
  // The Escape that closes a tooltip stops there (WCAG 1.4.13).
  const handleTileKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onBoard || event.target !== event.currentTarget) return;
    // A single key is safe here: it only acts while the tile itself has focus
    if (event.key.toLowerCase() === 'f' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      toggleLabelFilter(row.slug);
    } else if (event.key === 'Enter' && !expanded) {
      event.preventDefault();
      handleNameClick();
    } else if (event.key === 'Escape' && expanded && !isHoverContentOpen()) {
      collapse();
    }
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitName();
      refocusTile();
    }
    if (event.key === 'Escape') {
      setEditingName(null);
      refocusTile();
    }
  };

  const commitName = () => {
    const name = labelName(editingName?.trim() ?? '', row.mode);
    setEditingName(null);
    // Compared raw as well: Tab passes through this field, and must not slugify an older name nobody edited
    if (!name || name === row.name || editingName === row.name) return;
    // A tag or an epic renames every row of its slug group, one per project
    for (const id of row.siblingIds) updateLabel.mutate({ id, ops: { name } });
  };

  const showsTint = isEpic && !expanded;

  return (
    <li>
      <div
        id={domId}
        ref={tileRef}
        tabIndex={onBoard ? (isCurrent ? 0 : -1) : undefined}
        role={onBoard ? 'article' : undefined}
        aria-label={onBoard ? row.name : undefined}
        onFocus={handleTileFocus}
        onKeyDown={handleTileKeyDown}
        className={cn(
          'group/label-tile relative border-b text-sm',
          onBoard &&
            'before:bg-primary outline-none before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1 before:opacity-0',
          onBoard && itemFocusBarClass,
          // An open tile keeps the hover tint, so it stands out among the closed ones
          'pointer-fine:focus-within:bg-card hover:bg-card focus-visible:bg-card has-[:focus-visible]:bg-card',
          expanded && 'bg-card',
          isDragging && 'opacity-30',
          !expanded && !(onBoard && isCurrent) && 'resting-text transition-[color]',
        )}
      >
        {showsTint && <EpicTint progress={progress} />}
        {/* Positioned, so the row paints above the tint behind it */}
        <div className="relative flex min-h-11 items-center gap-2 px-4 py-1.5">
          {/* A collapsed tile holds the room of its floating button, so a long name's count stays clear of it */}
          <div className={cn('flex min-w-0 grow items-center gap-2', !expanded && 'pr-9')}>
            {/* No gap inside: the folded grip takes no room beside the name */}
            <div className={cn('flex min-w-0 items-center', editingName !== null && 'grow')}>
              {expanded && canReorder && position && onMove && (
                <div data-open={gripHasFocus || undefined} className={gripFoldClass} onFocus={() => setGripHasFocus(true)} onBlur={handleGripBlur}>
                  <div className="min-h-0 min-w-0 overflow-clip">
                    <ReorderHandle
                      id={row.id}
                      name={row.name}
                      index={position.index}
                      total={position.total}
                      onMove={moveByKey}
                      className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'focus-inset size-8')}
                    >
                      <GripVerticalIcon className="size-3.5" />
                    </ReorderHandle>
                  </div>
                </div>
              )}
              {/* Edit and display boxes share height, padding and border so the swap causes no layout shift */}
              {editingName !== null ? (
                <Input
                  value={editingName}
                  aria-label={t('c:name')}
                  autoFocus
                  onChange={(event) => setEditingName(event.target.value)}
                  onBlur={commitName}
                  onKeyDown={handleNameKeyDown}
                  className="-ml-1.25 h-7 w-auto grow px-1 font-semibold"
                />
              ) : expanded ? (
                // The open name is the drag handle and nothing else: a rename goes through the ⋮ menu
                <span
                  ref={setNameHandle}
                  className={cn('-ml-1.25 flex h-7 min-w-0 items-center px-1 font-semibold', canReorder && 'cursor-grab active:cursor-grabbing')}
                >
                  <span className="truncate">
                    <HighlightText text={row.name} />
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  // On the board the tile takes the keys, so the name is no second Tab stop
                  tabIndex={onBoard ? -1 : undefined}
                  aria-expanded={isEpic ? false : undefined}
                  onClick={handleNameClick}
                  // An after-overlay stretches the button over the whole tile; the action buttons sit above it
                  className="-ml-1.25 flex h-7 min-w-0 items-center rounded-md border border-transparent px-1 text-left outline-0 after:absolute after:inset-0"
                >
                  <span className="truncate">
                    <HighlightText text={row.name} />
                  </span>
                </button>
              )}
            </div>
            {/* z-1 lifts it above the collapsed name's overlay: a press filters the board, the rest of the tile opens it */}
            {editingName === null && (
              <LabelFilterCount
                name={row.name}
                slug={row.slug}
                count={row.usedCount}
                onAction={onAction}
                // The tint lowers the contrast of the muted count, so a closed epic's count is set in the text color
                className={showsTint ? 'text-foreground font-semibold' : undefined}
              />
            )}
            {!isEpic && !isReadOnly && editingName === null && (
              <TooltipButton toolTipContent={t('c:make_epic')} side="top" sideOffset={5}>
                <button
                  type="button"
                  aria-label={t('c:make_epic')}
                  onClick={handleMakeEpic}
                  className={cn(
                    'border-input text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring relative z-1 flex h-5.5 shrink-0 items-center gap-0.5 rounded-full border border-dashed pr-2 pl-1.5 text-xs font-medium outline-0 hover:border-solid focus-visible:ring-2',
                    actionClass,
                    restingActionsPointer,
                    touchAtRest,
                  )}
                >
                  <PlusIcon className="size-3" />
                  {t('c:epic')}
                </button>
              </TooltipButton>
            )}
          </div>

          {/* Floating and in-flow actions share the row's right padding, so they keep their place when the tile
              expands; close joins on their left */}
          <div
            className={cn(
              'flex items-center gap-1',
              expanded ? 'shrink-0' : ['absolute inset-y-0 right-4', restingActionsPointer, !isEpic && touchAtRest],
            )}
          >
            <AnimatePresence initial={false}>
              {expanded && (
                <CardCloseButton
                  key="close"
                  className={actionClass}
                  onClick={() => {
                    // The button unmounts, which would drop focus out of the tile
                    if (onBoard) focusItem(domId);
                    collapse();
                  }}
                />
              )}
            </AnimatePresence>
            <LabelOptionsButton row={row} canManage={!isReadOnly} onRename={() => setEditingName(row.name)} className={actionClass} />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div key="details" {...labelTileReveal}>
              <LabelTileDetails
                row={row}
                progress={progress}
                lockedByProjectIds={lockedByProjectIds}
                scopeProjectIds={scopeProjectIds}
                onAction={onAction}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {closestEdge && <DropIndicator edge={closestEdge} gap={0.25} />}
      </div>
    </li>
  );
}
