import { useSearch } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelName } from 'shared/config/labels-config';
import { HighlightText } from '~/modules/common/match-highlight/highlight-text';
import { LabelFilterButton } from '~/modules/label/label-filter-button';
import { LabelOptionsButton } from '~/modules/label/label-options-button';
import { isLabelInSearch } from '~/modules/label/label-search';
import { LabelTileDetails, labelTileReveal } from '~/modules/label/label-tile-details';
import { labelTileStore, useLabelTileStore } from '~/modules/label/label-tile-store';
import { useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow, LabelsHostProps } from '~/modules/label/types';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { boardFocusStore, useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { CardCloseButton } from '~/modules/task/card/card-close-button';
import { toggleLabelFilter } from '~/modules/task/helpers/board-navigation';
import { focusItem, markCurrentItemMounted, setCurrentItem, takePendingFocus } from '~/modules/task/helpers/focus-item';
import { useItemControlsTabOrder } from '~/modules/task/hooks/use-item-controls-tab-order';
import { itemFocusBarClass } from '~/modules/task/task-styles';
import { Badge } from '~/modules/ui/badge';
import { Input } from '~/modules/ui/input';
import { cn } from '~/utils/cn';
import { formatCount } from '~/utils/format-count';
import { isHoverContentOpen } from '~/utils/is-hover-content-open';
import { tw } from '~/utils/tw';

// Like a task card's actions: hidden until the tile is hovered or holds focus, then each slides in from the right like the
// close button. On a collapsed tile pointer events follow, so a tap lands on the tile and expands it. Focus from a tap must
// not reveal there: the buttons would appear under the finger between press and release, and the browser then fires no click.
const actionSlide = tw(
  'translate-x-3 opacity-0 transition-[translate,opacity,color,background-color] duration-200 ease-out motion-reduce:transition-none',
);
const restingActionsReveal = tw(
  'group-hover/label-tile:translate-x-0 group-hover/label-tile:opacity-100 group-focus-visible/label-tile:translate-x-0 group-focus-visible/label-tile:opacity-100 group-has-[:focus-visible]/label-tile:translate-x-0 group-has-data-dropdowner-active/label-tile:translate-x-0 group-has-data-dropdowner-done/label-tile:translate-x-0 group-has-[:focus-visible]/label-tile:opacity-100 group-has-data-dropdowner-active/label-tile:opacity-100 group-has-data-dropdowner-done/label-tile:opacity-100',
);
const restingActionsPointer = tw(
  'pointer-events-none group-hover/label-tile:pointer-events-auto group-focus-visible/label-tile:pointer-events-auto has-data-dropdowner-active:pointer-events-auto has-data-dropdowner-done:pointer-events-auto group-has-[:focus-visible]/label-tile:pointer-events-auto',
);
// A phone has no hover, so an open tile shows them throughout
const openActionsReveal = tw(
  'group-focus-within/label-tile:translate-x-0 group-focus-within/label-tile:opacity-100 group-hover/label-tile:translate-x-0 group-hover/label-tile:opacity-100 group-has-data-dropdowner-active/label-tile:translate-x-0 group-has-data-dropdowner-done/label-tile:translate-x-0 group-has-data-dropdowner-active/label-tile:opacity-100 group-has-data-dropdowner-done/label-tile:opacity-100 max-sm:translate-x-0 max-sm:opacity-100',
);
const metaHide = tw(
  'transition-opacity group-hover/label-tile:opacity-0 group-focus-visible/label-tile:opacity-0 group-has-[:focus-visible]/label-tile:opacity-0 group-has-data-dropdowner-active/label-tile:opacity-0 group-has-data-dropdowner-done/label-tile:opacity-0 motion-reduce:transition-none',
);
// Transparent under the floating filter and options buttons (2 × 2rem + a 0.25rem gap), then a 1.5rem fade. A mask fades the
// text itself, so it works on the hover tint and on the transparent panel.
const nameFade = tw(
  'group-hover/label-tile:[mask-image:linear-gradient(to_left,transparent_4.25rem,black_5.75rem)] group-focus-visible/label-tile:[mask-image:linear-gradient(to_left,transparent_4.25rem,black_5.75rem)] group-has-[:focus-visible]/label-tile:[mask-image:linear-gradient(to_left,transparent_4.25rem,black_5.75rem)]',
);

interface LabelTileProps extends Pick<LabelsHostProps, 'singleExpand' | 'onAction'> {
  row: LabelRow;
  /** A tile in the board panel is a board item: one Tab stop for the list, arrow keys between tiles. */
  onBoard?: boolean;
}

/** DOM id of a label tile, so a label link can scroll its tile into view. */
export const labelTileDomId = (labelId: string) => `label-tile-${labelId}`;

/** A click expands the tile in place, like a task card; a click on the expanded name renames it, and on the board Enter does both. */
export function LabelTile({ row, singleExpand, onAction, onBoard }: LabelTileProps) {
  const { t } = useTranslation();

  const expanded = useLabelTileStore((state) => !!state.expandedIds[row.id]);
  const isInSearch = useSearch({ strict: false, select: (search) => isLabelInSearch(search.q, row.name) });

  // Read-only viewers (guest membership or public access) cannot rename, switch mode or delete
  const isReadOnly = useIsProjectReadOnly(row.projectId);
  const updateLabel = useLabelUpdateMutation(row.tenantId, row.organizationId);
  const [editingName, setEditingName] = useState<string | null>(null);

  const domId = labelTileDomId(row.id);
  const isCurrent = useBoardFocusStore((state) => state.currentItemId === domId);
  const tileRef = useRef<HTMLDivElement>(null);
  // Off the board (the mobile drawer) a tile keeps its controls in the Tab order. On it, as with a task card, a collapsed
  // tile is one Tab stop: Enter opens it, and only then does Tab reach its controls, cycling inside it.
  useItemControlsTabOrder(tileRef, domId, onBoard ? isCurrent && expanded : true, { trap: onBoard });

  // Mounting as the current tile: take the focus a keypress left for it, and hold the list's Tab stop
  useEffect(() => {
    if (!onBoard || !isCurrent) return;
    takePendingFocus(domId, tileRef.current);
    return markCurrentItemMounted(domId);
  }, [onBoard, isCurrent, domId]);

  const handleNameClick = () => {
    if (expanded) {
      if (!isReadOnly) setEditingName(row.name);
      return;
    }
    // A collapsed name spans the tile: a click on it focuses the tile, as on a task card, so the arrow keys go on from it
    if (onBoard) focusItem(domId);
    labelTileStore.getState().expand(row.id, singleExpand);
  };

  // Back to the tile after a keyboard rename, once the field has unmounted: blurring it first would commit again
  const refocusTile = () => {
    if (onBoard) requestAnimationFrame(() => tileRef.current?.focus());
  };

  const collapse = () => labelTileStore.getState().collapse(row.id);
  const actionClass = cn(actionSlide, expanded ? openActionsReveal : restingActionsReveal);

  const handleTileFocus = () => {
    if (onBoard && boardFocusStore.getState().currentItemId !== domId) setCurrentItem(domId);
  };

  // On the tile itself, as on a task card: Enter opens it, then renames it; Escape closes it and keeps focus on it.
  // The Escape that closes a tooltip stops there (WCAG 1.4.13).
  const handleTileKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onBoard || event.target !== event.currentTarget) return;
    // A single key is safe here: it only acts while the tile itself has focus
    if (event.key.toLowerCase() === 'f' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      toggleLabelFilter(row.name);
    } else if (event.key === 'Enter') {
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
    if (!name || name === row.name) return;
    // Secondary slug groups rename every sibling row; epics rename their single row
    const ids = row.mode === 'epic' ? [row.id] : row.siblingIds;
    for (const id of ids) updateLabel.mutate({ id, ops: { name } });
  };

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
            'outline-none before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:opacity-0',
          onBoard && itemFocusBarClass,
          'focus-within:bg-muted/50 hover:bg-muted/50',
          !expanded && !(onBoard && isCurrent) && 'resting-text transition-[color]',
        )}
      >
        <div className="flex min-h-11 items-center gap-2 px-4 py-1.5">
          {/* Name and count share one box that reaches the row's edge: on a collapsed tile the actions float over
              its end, which fades out beneath them, so no width is held for buttons that are hidden */}
          <div className={cn('flex min-w-0 grow items-center gap-2', !expanded && nameFade)}>
            {/* Edit and display boxes share height, padding and border so the swap causes no layout shift */}
            {editingName !== null ? (
              <Input
                value={editingName}
                autoFocus
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={commitName}
                onKeyDown={handleNameKeyDown}
                className="-ml-1.25 h-7 w-auto grow px-1 font-semibold"
              />
            ) : (
              <button
                type="button"
                aria-expanded={expanded}
                title={expanded && !isReadOnly ? t('c:edit') : undefined}
                onClick={handleNameClick}
                className={cn(
                  '-ml-1.25 flex h-7 min-w-0 items-center rounded-md border border-transparent px-1 text-left outline-0',
                  // Collapsed, an after-overlay stretches the button over the whole tile; the action buttons sit above it
                  expanded ? 'font-semibold hover:bg-muted focus-visible:bg-muted' : 'after:absolute after:inset-0',
                )}
              >
                <span className="truncate">
                  <HighlightText text={row.name} />
                </span>
              </button>
            )}
            {!expanded && (
              <div className={cn('ml-auto flex shrink-0 items-center gap-1', metaHide)}>
                {row.mode === 'epic' && (
                  <Badge variant="secondary" className="mr-1">
                    {t('c:epic')}
                  </Badge>
                )}
                {/* The pressed toggle floats over this slot */}
                {isInSearch && <span className="size-8" />}
                <span className="w-8 text-center text-muted-foreground text-xs tabular-nums">{formatCount(row.usedCount)}</span>
              </div>
            )}
          </div>

          {/* Floating and in-flow actions share the row's right padding, so they keep their place when the tile
              expands; close joins on their left */}
          <div className={cn('flex items-center gap-1', expanded ? 'shrink-0' : ['absolute inset-y-0 right-4', restingActionsPointer])}>
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
            <LabelFilterButton name={row.name} isPressed={isInSearch} onAction={onAction} className={actionClass} />
            <LabelOptionsButton row={row} canManage={!isReadOnly} className={actionClass} />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div key="details" {...labelTileReveal}>
              <LabelTileDetails row={row} canManage={!isReadOnly} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}
