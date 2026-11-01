import { zLabel } from 'sdk/zod.gen';
import { describe, expect, it } from 'vitest';
import { groupLabelRows } from '~/modules/label/group-labels';
import { getSchemaDefaults } from '~/query/basic/create-optimistic';

const label = (id: string, slug: string, projectId: string) => ({ ...getSchemaDefaults(zLabel), id, slug, name: slug, projectId });

describe('groupLabelRows', () => {
  it('sums the usage of the labels that share a slug across projects', () => {
    const rows = groupLabelRows([label('a1', 'bug', 'p1'), label('a2', 'bug', 'p2'), label('b1', 'docs', 'p1')], {
      usage: { a1: 2, a2: 3 },
      totals: { a1: 4, a2: 10 },
    });

    expect(rows.map(({ slug, usedCount, totalCount, siblingIds }) => ({ slug, usedCount, totalCount, siblingIds }))).toEqual([
      { slug: 'bug', usedCount: 5, totalCount: 14, siblingIds: ['a1', 'a2'] },
      { slug: 'docs', usedCount: 0, totalCount: 0, siblingIds: ['b1'] },
    ]);
  });

  it('counts a label as unused without usage', () => {
    expect(groupLabelRows([label('a1', 'bug', 'p1')])[0].usedCount).toBe(0);
  });
});
