import { zLabel } from 'sdk/zod.gen';
import { describe, expect, it } from 'vitest';
import { deduplicateLabels, groupLabelRows } from '~/modules/label/group-labels';
import { getSchemaDefaults } from '~/query/basic/create-optimistic';

const label = (id: string, slug: string, projectId: string, displayOrder: number | null = null) => ({
  ...getSchemaDefaults(zLabel),
  id,
  slug,
  name: slug,
  projectId,
  displayOrder,
});

const epic = (id: string, slug: string, projectId: string, createdAt: string) => ({
  ...label(id, slug, projectId),
  mode: 'epic' as const,
  createdAt,
});

describe('groupLabelRows', () => {
  it('sums the usage of the labels that share a slug across projects', () => {
    const rows = groupLabelRows([label('a1', 'bug', 'p1'), label('a2', 'bug', 'p2'), label('b1', 'docs', 'p1')], {
      usage: { a1: 2, a2: 3 },
    });

    expect(rows.map(({ slug, usedCount, siblingIds }) => ({ slug, usedCount, siblingIds }))).toEqual([
      { slug: 'bug', usedCount: 5, siblingIds: ['a1', 'a2'] },
      { slug: 'docs', usedCount: 0, siblingIds: ['b1'] },
    ]);
  });

  it('counts a label as unused without usage', () => {
    expect(groupLabelRows([label('a1', 'bug', 'p1')])[0].usedCount).toBe(0);
  });

  it('adds the heat of the labels that share a slug, whichever sibling represents the group', () => {
    const labels = [label('a1', 'bug', 'p1', 3000), label('a2', 'bug', 'p2', 3000), label('a3', 'bug', 'p3')];
    expect(groupLabelRows(labels)[0].displayOrder).toBeCloseTo(3001);
    expect(groupLabelRows(labels, { preferredProjectId: 'p2' })[0]).toMatchObject({ id: 'a2', displayOrder: expect.closeTo(3001) });
  });

  it('keeps an epic apart from the tag that shares its slug in other projects', () => {
    const tag = { ...label('t1', 'sync', 'p1'), mode: 'secondary' as const };
    const rows = groupLabelRows([tag, epic('e2', 'sync', 'p2', '2026-01-02'), epic('e3', 'sync', 'p3', '2026-01-01')]);
    expect(rows.map(({ mode, siblingIds }) => ({ mode, siblingIds }))).toEqual([
      { mode: 'secondary', siblingIds: ['t1'] },
      { mode: 'epic', siblingIds: ['e2', 'e3'] },
    ]);
  });

  it('represents an epic group by the row holding its description, else its oldest row', () => {
    const rows = groupLabelRows([epic('e2', 'sync', 'p2', '2026-01-02'), epic('e3', 'sync', 'p3', '2026-01-01')], { preferredProjectId: 'p2' });
    expect(rows[0].id).toBe('e3');
    const described = { ...epic('e2', 'sync', 'p2', '2026-01-02'), description: '[{"type":"paragraph"}]' };
    expect(groupLabelRows([epic('e3', 'sync', 'p3', '2026-01-01'), described])[0].id).toBe('e2');
  });
});

describe('deduplicateLabels', () => {
  it('lists the hottest group first', () => {
    const rows = deduplicateLabels([label('a1', 'bug', 'p1', 2990), label('b1', 'docs', 'p1', 3000), label('b2', 'docs', 'p2', 3000)], 'p1');
    expect(rows.map(({ slug }) => slug)).toEqual(['docs', 'bug']);
  });
});
