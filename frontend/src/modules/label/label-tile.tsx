import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { HighlightText } from '~/modules/common/match-highlight';
import { searchHighlightRowClass } from '~/modules/common/search-highlight';
import { LabelFilterButton } from '~/modules/label/label-filter';
import { LabelOptionsButton } from '~/modules/label/label-options-button';
import { LabelTileDetails, labelTileReveal } from '~/modules/label/label-tile-details';
import { labelTileDomId, useLabelTileStore } from '~/modules/label/label-tile-store';
import { useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow, LabelsHostProps } from '~/modules/label/types';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { CardCloseButton } from '~/modules/task/card/card-close-button';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { Badge } from '~/modules/ui/badge';
import { Checkbox } from '~/modules/ui/checkbox';
import { Input } from '~/modules/ui/input';
import { cn } from '~/utils/cn';

// Like a task card's actions: hidden on a collapsed tile until hover or keyboard focus. Pointer events
// follow the opacity, so a tap lands on the tile and expands it. Focus from a tap must not reveal: the
// buttons would appear under the finger between press and release, and the browser then fires no click.
const actionsReveal =
  'pointer-events-none opacity-0 transition-opacity group-has-[:focus-visible]/labelTile:pointer-events-auto group-has-[:focus-visible]/labelTile:opacity-100 group-hover/labelTile:pointer-events-auto group-hover/labelTile:opacity-100 has-data-dropdowner-done:opacity-100 motion-reduce:transition-none';
const metaHide =
  'transition-opacity group-has-[:focus-visible]/labelTile:opacity-0 group-hover/labelTile:opacity-0 group-has-data-dropdowner-done/labelTile:opacity-0 motion-reduce:transition-none';
// Transparent under the floating filter and options buttons (2 × 2rem + 0.25rem gap), then a 1.5rem fade. A mask
// fades the text itself, so it works on every row tint (hover, search highlight) and on the transparent panel.
const nameFade =
  'group-hover/labelTile:[mask-image:linear-gradient(to_left,transparent_4.25rem,black_5.75rem)] group-has-[:focus-visible]/labelTile:[mask-image:linear-gradient(to_left,transparent_4.25rem,black_5.75rem)]';

type LabelTileProps = Pick<LabelsHostProps, 'selectable' | 'singleExpand' | 'onFilterToggle'> & {
  row: LabelRow;
  highlighted: boolean;
};

/**
 * One label in the labels list. A click expands it in place, like a task card: the tile grows to show
 * its details and a click on the expanded name renames it.
 */
export function LabelTile({ row, highlighted, selectable = true, singleExpand, onFilterToggle }: LabelTileProps) {
  const { t } = useTranslation();
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const expanded = useLabelTileStore((s) => !!s.expandedIds[row.id]);
  const isSelected = useTaskInteractionStore((s) => s.selectedLabelIds.includes(row.id));
  // Task and label selection are mutually exclusive so the shared remove button targets one kind
  const hasSelectedTasks = useTaskInteractionStore((s) => s.selectedTaskIds.length > 0);

  // Read-only viewers (guest membership or public access) cannot rename, switch mode or delete
  const isReadOnly = useIsProjectReadOnly(row.projectId);
  const updateLabel = useLabelUpdateMutation(tenantId, organizationId);
  const [editingName, setEditingName] = useState<string | null>(null);

  const onSelect = (checked: boolean) => {
    const { selectedLabelIds, setSelectedLabelIds } = useTaskInteractionStore.getState();
    setSelectedLabelIds(checked ? [...selectedLabelIds, row.id] : selectedLabelIds.filter((id) => id !== row.id));
  };

  const onNameClick = () => {
    if (!expanded) useLabelTileStore.getState().expand(row.id, singleExpand);
    else if (!isReadOnly) setEditingName(row.name);
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
      id={labelTileDomId(row.id)}
      className={cn(
        'group/labelTile relative border-b text-sm',
        expanded ? 'bg-accent/20' : 'focus-within:bg-accent/30 hover:bg-accent/30',
        highlighted && searchHighlightRowClass,
      )}
    >
      <div className="flex min-h-11 items-center gap-2 px-3 py-1.5">
        {selectable && (
          <Checkbox
            className="relative z-10 data-[state=checked]:border-primary"
            checked={isSelected}
            disabled={hasSelectedTasks}
            aria-label={row.name}
            onCheckedChange={(checked) => onSelect(checked === true)}
          />
        )}

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
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitName();
                if (event.key === 'Escape') setEditingName(null);
              }}
              className="-ml-1.25 h-7 w-auto grow px-1 font-semibold"
            />
          ) : (
            <button
              type="button"
              aria-expanded={expanded}
              title={expanded && !isReadOnly ? t('c:edit') : undefined}
              onClick={onNameClick}
              className={cn(
                '-ml-1.25 flex h-7 min-w-0 items-center rounded-md border border-transparent px-1 text-left outline-0 ring-0',
                // Collapsed, an after-overlay stretches the button over the whole tile; the checkbox and buttons sit above it
                expanded ? 'font-semibold hover:bg-accent/50 focus-visible:bg-accent/50' : "after:absolute after:inset-0 after:content-['']",
              )}
            >
              <span className={cn('truncate', !expanded && 'opacity-80 group-focus-within/labelTile:opacity-100 group-hover/labelTile:opacity-100')}>
                <HighlightText text={row.name} />
              </span>
            </button>
          )}
          {!expanded && (
            <div className={cn('ml-auto flex shrink-0 items-center gap-2', metaHide)}>
              {row.mode === 'epic' && <Badge variant="secondary">{t('c:epic')}</Badge>}
              <span className="text-muted-foreground text-xs tabular-nums">{row.usedCount}</span>
            </div>
          )}
        </div>

        {/* Floating and in-flow actions share the row's right padding, so filter and options keep their place
            when the tile expands; close joins on their left */}
        <div className={cn('flex items-center gap-1', expanded ? 'shrink-0' : cn('absolute inset-y-0 right-3', actionsReveal))}>
          <AnimatePresence initial={false}>
            {expanded && <CardCloseButton key="close" onClick={() => useLabelTileStore.getState().collapse(row.id)} />}
          </AnimatePresence>
          <LabelFilterButton name={row.name} size="xs" className="relative z-10 h-8 w-8" onToggle={onFilterToggle} />
          <LabelOptionsButton row={row} canManage={!isReadOnly} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="details" {...labelTileReveal}>
            <LabelTileDetails row={row} indented={selectable} canManage={!isReadOnly} />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
