import { describe, expect, it } from 'vitest';
import { combineRanks, compareLabelHeat, getDroppedLabelRank } from '~/modules/label/label-order';
import type { LabelRow } from '~/modules/label/types';

const row = (id: string, displayOrder: number | null, usedCount = 0, name = id) => ({ id, displayOrder, usedCount, name }) as LabelRow;

describe('compareLabelHeat', () => {
  it('sorts the hottest first, the never used by use and then name', () => {
    const rows = [row('cold-b', null, 1, 'b'), row('warm', 2900), row('hot', 2966), row('cold-a', null, 1, 'a'), row('cold-c', null, 3, 'c')];
    expect(rows.sort(compareLabelHeat).map(({ id }) => id)).toEqual(['hot', 'warm', 'cold-c', 'cold-a', 'cold-b']);
  });
});

describe('combineRanks', () => {
  it('adds heat in the log scale, a rank without heat left out', () => {
    expect(combineRanks(3000, 3000)).toBeCloseTo(3001);
    expect(combineRanks(3000, 2990)).toBeCloseTo(3000.0014, 3);
    expect(combineRanks(null, 2990)).toBe(2990);
    expect(combineRanks(null, null)).toBeNull();
  });
});

describe('getDroppedLabelRank', () => {
  const rows = [row('hot', 2970), row('warm', 2960), row('mild', 2950)];

  it('places the row between its new neighbours', () => {
    const rank = getDroppedLabelRank(rows, 'mild', 'hot', 'bottom');
    expect(rank).toBeGreaterThan(2960);
    expect(rank).toBeLessThan(2970);
  });

  it('places a row dropped past an end one rank beyond it: twice or half its heat, no pin', () => {
    expect(getDroppedLabelRank(rows, 'mild', 'hot', 'top')).toBe(2971);
    expect(getDroppedLabelRank(rows, 'hot', 'mild', 'bottom')).toBe(2949);
  });

  it('places a never used row among the ranked', () => {
    const rank = getDroppedLabelRank([...rows, row('cold', null)], 'cold', 'warm', 'top');
    expect(rank).toBeGreaterThan(2960);
    expect(rank).toBeLessThan(2970);
  });

  it('returns null for a drop that leaves the row in its slot', () => {
    expect(getDroppedLabelRank(rows, 'warm', 'hot', 'bottom')).toBeNull();
    expect(getDroppedLabelRank(rows, 'warm', 'missing', 'bottom')).toBeNull();
  });
});
