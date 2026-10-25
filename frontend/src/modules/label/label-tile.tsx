import { useSearch } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HighlightText } from '~/modules/common/match-highlight/highlight-text';
import { LabelActions, labelActionIcons } from '~/modules/label/label-actions';
import { LabelOptionsButton } from '~/modules/label/label-options-button';
import { type LabelAction, labelSearchMode, parseHiddenLabels } from '~/modules/label/label-search';
import { LabelTileDetails, labelTileReveal } from '~/modules/label/label-tile-details';
import { labelTileStore, useLabelTileStore } from '~/modules/label/label-tile-store';
import { useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow, LabelsHostProps } from '~/modules/label/types';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { boardFocusStore, useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { CardCloseButton } from '~/modules/task/card/card-close-button';
import { applyLabelAction } from '~/modules/task/helpers/board-navigation';
import { markCurrentItemMounted, setCurrentItem, takePendingFocus } from '~/modules/task/helpers/focus-item';
import { useItemControlsTabOrder } from '~/modules/task/hooks/use-item-controls-tab-order';
import { searchHighlightRowClass } from '~/modules/task/search-highlight';
import { Badge } from '~/modules/ui/badge';
import { Input } from '~/modules/ui/input';
import { cn } from '~/utils/cn';
import { tw } from '~/utils/tw';

// Like a task card's actions: hidden on a collapsed tile until hover or keyboard focus. Pointer events
// follow the opacity, so a tap lands on the tile and expands it. Focus from a tap must not reveal: the
// buttons would appear under the finger between press and release, and the browser then fires no click.
const actionsReveal = tw(
  'pointer-events-none opacity-0 transition-opacity group-hover/label-tile:pointer-events-auto group-hover/label-tile:opacity-100 group-focus-visible/label-tile:pointer-events-auto group-focus-visible/label-tile:opacity-100 has-data-dropdowner-done:opacity-100 group-has-[:focus-visible]/label-tile:pointer-events-auto group-has-[:focus-visible]/label-tile:opacity-100 motion-reduce:transition-none',
);
const metaHide = tw(
  'transition-opacity group-hover/label-tile:opacity-0 group-focus-visible/label-tile:opacity-0 group-has-[:focus-visible]/label-tile:opacity-0 group-has-data-dropdowner-done/label-tile:opacity-0 motion-reduce:transition-none',
);
// Transparent under the floating filter, highlight, hide and options buttons (4 × 2rem + 3 × 0.25rem gaps), then a 1.5rem
// fade. A mask fades the text itself, so it works on every row tint (hover, search highlight) and on the transparent panel.
const nameFade = tw(
  'group-hover/label-tile:[mask-image:linear-gradient(to_left,transparent_8.75rem,black_10.25rem)] group-focus-visible/label-tile:[mask-image:linear-gradient(to_left,transparent_8.75rem,black_10.25rem)] group-has-[:focus-visible]/label-tile:[mask-image:linear-gradient(to_left,transparent_8.75rem,black_10.25rem)]',
);

const activeIconClass: Record<LabelAction, string> = {
  filter: tw('text-primary'),
  highlight: tw('text-green-700 dark:text-green-300'),
  hide: tw('text-muted-foreground'),
};

// Single keys are safe here: they only act while the tile itself has focus
const tileKeyActions: Partial<Record<string, LabelAction>> = { f: 'filter', h: 'highlight', x: 'hide' };

interface LabelTileProps extends Pick<LabelsHostProps, 'singleExpand' | 'onAction'> {
  row: LabelRow;
  highlighted: boolean;
  /** A tile in the board panel is a board item: one Tab stop for the list, arrow keys between tiles. */
  onBoard?: boolean;
}

/** DOM id of a label tile, so a label link can scroll its tile into view. */
export const labelTileDomId = (labelId: string) => `label-tile-${labelId}`;

/** A click expands the tile in place, like a task card; a click on the expanded name renames it, and on the board Enter does both. */
export function LabelTile({ row, highlighted, singleExpand, onAction, onBoard }: LabelTileProps) {
  const { t } = useTranslation();

  const expanded = useLabelTileStore((state) => !!state.expandedIds[row.id]);
  const searchMode = useSearch({ strict: false, select: (search) => labelSearchMode(search.q, row.name) });
  const isHidden = useSearch({ strict: false, select: (search) => parseHiddenLabels(search.hide).includes(row.slug) });
  const active: LabelAction | null = isHidden ? 'hide' : searchMode;
  const ActiveIcon = active && labelActionIcons[active];

  // Read-only viewers (guest membership or public access) cannot rename, switch mode or delete
  const isReadOnly = useIsProjectReadOnly(row.projectId);
  const updateLabel = useLabelUpdateMutation(row.tenantId, row.organizationId);
  const [editingName, setEditingName] = useState<string | null>(null);

  const domId = labelTileDomId(row.id);
  const isCurrent = useBoardFocusStore((state) => state.currentItemId === domId);
  const tileRef = useRef<HTMLLIElement>(null);
  // Off the board (the mobile drawer) a tile keeps its controls in the Tab order
  useItemControlsTabOrder(tileRef, domId, isCurrent || !onBoard);

  // Mounting as the current tile: take the focus a keypress left for it, and hold the list's Tab stop
  useEffect(() => {
    if (!onBoard || !isCurrent) return;
    takePendingFocus(domId, tileRef.current);
    return markCurrentItemMounted(domId);
  }, [onBoard, isCurrent, domId]);

  const handleNameClick = () => {
    if (!expanded) labelTileStore.getState().expand(row.id, singleExpand);
    else if (!isReadOnly) setEditingName(row.name);
  };

  // Back to the tile after a keyboard rename, once the field has unmounted: blurring it first would commit again
  const refocusTile = () => {
    if (onBoard) requestAnimationFrame(() => tileRef.current?.focus());
  };

  const collapse = () => labelTileStore.getState().collapse(row.id);

  const handleTileFocus = () => {
    if (onBoard && boardFocusStore.getState().currentItemId !== domId) setCurrentItem(domId);
  };

  // On the tile itself, as on a task card: Enter opens it, then renames it; Escape closes it, then leaves it
  const handleTileKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (!onBoard || event.target !== event.currentTarget) return;
    const keyAction = event.altKey || event.ctrlKey || event.metaKey ? undefined : tileKeyActions[event.key.toLowerCase()];
    if (keyAction) {
      event.preventDefault();
      applyLabelAction(row, keyAction);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleNameClick();
    } else if (event.key === 'Escape') {
      if (expanded) collapse();
      else event.currentTarget.blur();
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
    const name = editingName?.trim();
    setEditingName(null);
    if (!name || name === row.name) return;
    // Secondary slug groups rename every sibling row; epics rename their single row
    const ids = row.mode === 'epic' ? [row.id] : row.siblingIds;
    for (const id of ids) updateLabel.mutate({ id, ops: { name } });
  };

  return (
    <li
      id={domId}
      ref={tileRef}
      tabIndex={onBoard ? (isCurrent ? 0 : -1) : undefined}
      aria-label={onBoard ? row.name : undefined}
      onFocus={handleTileFocus}
      onKeyDown={handleTileKeyDown}
      className={cn(
        'group/label-tile relative border-b text-sm',
        onBoard &&
          'outline-none before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary before:opacity-0',
        onBoard && isCurrent && 'before:opacity-100',
        expanded ? 'bg-accent/20' : 'focus-within:bg-accent/30 hover:bg-accent/30',
        highlighted && searchHighlightRowClass,
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
                expanded ? 'font-semibold hover:bg-accent/50 focus-visible:bg-accent/50' : 'after:absolute after:inset-0',
              )}
            >
              <span className={cn('truncate', isHidden && 'text-muted-foreground')}>
                <HighlightText text={row.name} />
              </span>
            </button>
          )}
          {!expanded && (
            <div className={cn('ml-auto flex shrink-0 items-center gap-2', metaHide)}>
              {row.mode === 'epic' && <Badge variant="secondary">{t('c:epic')}</Badge>}
              {ActiveIcon && <ActiveIcon aria-hidden className={cn('size-3.5', activeIconClass[active])} />}
              <span className="text-muted-foreground text-xs tabular-nums">{row.usedCount}</span>
            </div>
          )}
        </div>

        {/* Floating and in-flow actions share the row's right padding, so they keep their place when the tile
            expands; close joins on their left */}
        <div className={cn('flex items-center gap-1', expanded ? 'shrink-0' : ['absolute inset-y-0 right-4', actionsReveal])}>
          <AnimatePresence initial={false}>{expanded && <CardCloseButton key="close" onClick={collapse} />}</AnimatePresence>
          <LabelActions row={row} active={active} onAction={onAction} />
          <LabelOptionsButton row={row} canManage={!isReadOnly} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="details" {...labelTileReveal}>
            <LabelTileDetails row={row} canManage={!isReadOnly} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
