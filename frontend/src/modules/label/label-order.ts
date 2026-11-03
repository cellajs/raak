import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { getRelativeOrder } from 'shared/utils/display-order';
import type { LabelRow } from '~/modules/label/types';

/** Under every rank a bump or a drop writes (half-lives since the epoch, see the backend's label-heat.ts): a label never used sorts last. */
const coldRank = 0;

const rankOf = (row: Pick<LabelRow, 'displayOrder'>) => row.displayOrder ?? coldRank;

/** Hottest first; among labels never used, the most used, then the name. */
export const compareLabelHeat = (a: LabelRow, b: LabelRow) => rankOf(b) - rankOf(a) || b.usedCount - a.usedCount || a.name.localeCompare(b.name);

/** The rank of a group: its siblings' heat added, in the rank's log scale. */
export const combineRanks = (a: number | null, b: number | null): number | null => {
  if (a === null) return b;
  if (b === null) return a;
  const [high, low] = a > b ? [a, b] : [b, a];
  return high + Math.log2(1 + 2 ** (low - high));
};

/**
 * The rank a row dropped on an edge of another takes: between its new neighbours, as a task drop. Past the ends one
 * more or less than the end row, twice or half its heat: the task helper's gap would be a thousandfold, a pin for
 * weeks. Null when it stays where it is.
 */
export const getDroppedLabelRank = (rows: LabelRow[], sourceId: string, targetId: string, edge: Edge): number | null => {
  const source = rows.find((row) => row.id === sourceId);
  const target = rows.find((row) => row.id === targetId);
  if (!source || !target) return null;
  const items = rows.map((row) => ({ id: row.id, displayOrder: rankOf(row) }));
  const others = items.filter((item) => item.id !== sourceId).map((item) => item.displayOrder);
  let rank = getRelativeOrder(items, rankOf(target), sourceId, edge, false);
  if (rank > Math.max(...others)) rank = Math.max(...others) + 1;
  else if (rank < Math.min(...others)) rank = Math.min(...others) - 1;
  return rank === rankOf(source) ? null : rank;
};

/** The drag payload of a label tile, told apart from a task's or a panel's by `type`. */
export type LabelDraggableData = { dragItem: true; type: 'label'; id: string };

export const labelDragData = (id: string): LabelDraggableData => ({ dragItem: true, type: 'label', id });

export const isLabelData = (data: Record<string | symbol, unknown>): data is LabelDraggableData => data.dragItem === true && data.type === 'label';
