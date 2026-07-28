import { describe, expect, it } from 'vitest';
import type { EnrichedProject } from '~/modules/project/types';
import type { BoardResizablePanel } from '~/modules/task/types';
import { computePanelReorder, getPanelDisplayOrder, sortPanelsByOrder } from './board-hooks';

const makeProjectPanel = (projectId: string, displayOrder: number, panelId = projectId): BoardResizablePanel => ({
  kind: 'project',
  panelId,
  project: {
    id: projectId,
    tenantId: 't',
    organizationId: 'o',
    membership: { id: `m-${projectId}`, displayOrder },
  } as unknown as EnrichedProject,
});

// A section-filtered split panel of a project (sectionIndex seeds its default order offset).
// Section values are irrelevant to ordering, so filters stay empty.
const makeSplitPanel = (
  projectId: string,
  displayOrder: number,
  sectionIndex: number,
  panelId: string,
): BoardResizablePanel => ({
  kind: 'project',
  panelId,
  sectionFilters: { status: [] },
  sectionIndex,
  project: {
    id: projectId,
    tenantId: 't',
    organizationId: 'o',
    membership: { id: `m-${projectId}`, displayOrder },
  } as unknown as EnrichedProject,
});

// A local non-project panel representing any order-only board column.
const makeExtraPanel = (panelId: string): BoardResizablePanel => ({ kind: 'explainer', panelId });

const makeLabelsPanel = (panelId = 'labels'): BoardResizablePanel => ({ kind: 'labels', panelId });

describe('getPanelDisplayOrder', () => {
  it('reads server-owned membership.displayOrder for project panels', () => {
    expect(getPanelDisplayOrder(makeProjectPanel('a', 42))).toBe(42);
  });

  it('falls back to local orders for non-project panels', () => {
    expect(getPanelDisplayOrder(makeExtraPanel('explainer'), { explainer: 7 })).toBe(7);
  });

  it('falls back to the kind default when neither source has an order', () => {
    // Explainer leads the board, labels trails it; local orders override both
    expect(getPanelDisplayOrder(makeExtraPanel('explainer'))).toBe(-1_000_000);
    expect(getPanelDisplayOrder(makeLabelsPanel())).toBe(1_000_000);
    expect(getPanelDisplayOrder(makeLabelsPanel(), { labels: 15 })).toBe(15);
  });

  it('anchors a project panel without enriched membership mid-board, ahead of labels', () => {
    const bare: BoardResizablePanel = {
      kind: 'project',
      panelId: 'p',
      project: { id: 'p', tenantId: 't', organizationId: 'o' } as unknown as EnrichedProject,
    };
    expect(getPanelDisplayOrder(bare)).toBe(0);
  });

  it('prefers a device-local override over the server-owned order', () => {
    expect(getPanelDisplayOrder(makeProjectPanel('a', 42), { a: 999 })).toBe(999);
  });

  it('seeds split panels with distinct per-section offsets from the membership anchor', () => {
    expect(getPanelDisplayOrder(makeSplitPanel('a', 20, 0, 'a-s0'))).toBe(20);
    expect(getPanelDisplayOrder(makeSplitPanel('a', 20, 1, 'a-s1'))).toBe(20.001);
    // Local override beats the seeded order
    expect(getPanelDisplayOrder(makeSplitPanel('a', 20, 1, 'a-s1'), { 'a-s1': 5 })).toBe(5);
  });
});

describe('sortPanelsByOrder', () => {
  it('sorts project panels by membership.displayOrder', () => {
    const panels = [makeProjectPanel('a', 30), makeProjectPanel('b', 10), makeProjectPanel('c', 20)];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['b', 'c', 'a']);
  });

  it('intersperses local-only panels by their stored displayOrder', () => {
    const panels = [
      makeProjectPanel('a', 30),
      makeProjectPanel('b', 10),
      makeExtraPanel('explainer'),
      makeExtraPanel('ai-chat'),
    ];
    const sorted = sortPanelsByOrder(panels, { explainer: 5, 'ai-chat': 20 });
    expect(sorted.map((p) => p.panelId)).toEqual(['explainer', 'b', 'ai-chat', 'a']);
  });

  it('anchors kind defaults: explainer leads, labels trails, unknown kinds park at the end', () => {
    const panels = [
      makeProjectPanel('a', 30),
      makeLabelsPanel(),
      makeExtraPanel('explainer'),
      makeProjectPanel('b', 10),
    ];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['explainer', 'b', 'a', 'labels']);
  });

  it('keeps split panels grouped at their membership anchor by default', () => {
    const panels = [
      makeSplitPanel('a', 20, 0, 'a-status-started'),
      makeSplitPanel('a', 20, 1, 'a-status-finished'),
      makeProjectPanel('b', 10),
    ];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['b', 'a-status-started', 'a-status-finished']);
  });

  it('lets a local order pull one split panel away from its siblings', () => {
    const panels = [makeSplitPanel('a', 20, 0, 'a-s0'), makeSplitPanel('a', 20, 1, 'a-s1'), makeProjectPanel('b', 10)];
    expect(sortPanelsByOrder(panels, { 'a-s1': 5 }).map((p) => p.panelId)).toEqual(['a-s1', 'b', 'a-s0']);
  });
});

describe('computePanelReorder', () => {
  it('returns null when the source panel is unknown', () => {
    const panels = [makeProjectPanel('a', 10), makeProjectPanel('b', 20)];
    expect(computePanelReorder(panels, undefined, ['a', 'b'], 'missing')).toBeNull();
  });

  it('returns null for a single panel (no anchor to reorder against)', () => {
    const panels = [makeProjectPanel('a', 10)];
    expect(computePanelReorder(panels, undefined, ['a'], 'a')).toBeNull();
  });

  it('produces a membership update between two project panels', () => {
    const panels = [makeProjectPanel('a', 10), makeProjectPanel('b', 20), makeProjectPanel('c', 30)];
    // Drop c between a and b
    const result = computePanelReorder(panels, undefined, ['a', 'c', 'b'], 'c');
    expect(result).toMatchObject({ kind: 'membership', projectId: 'c', membershipId: 'm-c' });
    if (result?.kind === 'membership') {
      expect(result.displayOrder).toBeGreaterThan(10);
      expect(result.displayOrder).toBeLessThan(20);
    }
  });

  it('produces a local order for a local-only panel', () => {
    const panels = [makeProjectPanel('a', 10), makeExtraPanel('explainer'), makeProjectPanel('b', 30)];
    const result = computePanelReorder(panels, { explainer: 20 }, ['a', 'explainer', 'b'], 'explainer');
    expect(result).toMatchObject({ kind: 'local', panelId: 'explainer' });
    if (result?.kind === 'local') {
      expect(result.displayOrder).toBeGreaterThan(10);
      expect(result.displayOrder).toBeLessThan(30);
    }
  });

  it('returns null when the resulting membership order is unchanged (dropped in place)', () => {
    const panels = [makeProjectPanel('a', 10), makeProjectPanel('b', 20), makeProjectPanel('c', 30)];
    // b stays between a and c → getOrderBetween(10, 30) === 20 === b's current order
    expect(computePanelReorder(panels, undefined, ['a', 'b', 'c'], 'b')).toBeNull();
  });

  it('produces a local order for a split panel, never a membership update', () => {
    const panels = [makeSplitPanel('a', 10, 0, 'a-s0'), makeSplitPanel('a', 10, 1, 'a-s1'), makeProjectPanel('b', 30)];
    // Drag a's second split panel past b
    const result = computePanelReorder(panels, undefined, ['a-s0', 'b', 'a-s1'], 'a-s1');
    expect(result).toMatchObject({ kind: 'local', panelId: 'a-s1' });
    if (result?.kind === 'local') expect(result.displayOrder).toBeGreaterThan(30);
  });

  it('allows dropping another panel between two split siblings (seeded orders leave a gap)', () => {
    const panels = [makeSplitPanel('a', 10, 0, 'a-s0'), makeSplitPanel('a', 10, 1, 'a-s1'), makeProjectPanel('b', 30)];
    const result = computePanelReorder(panels, undefined, ['a-s0', 'b', 'a-s1'], 'b');
    expect(result).toMatchObject({ kind: 'membership', projectId: 'b' });
    if (result?.kind === 'membership') {
      expect(result.displayOrder).toBeGreaterThan(10);
      expect(result.displayOrder).toBeLessThan(10.001);
    }
  });

  it('forces a local order for an unsplit project panel when persist is local', () => {
    const panels = [makeProjectPanel('a', 10), makeLabelsPanel()];
    const result = computePanelReorder(panels, undefined, ['labels', 'a'], 'a', { persist: 'local' });
    expect(result).toMatchObject({ kind: 'local', panelId: 'a' });
    if (result?.kind === 'local') expect(result.displayOrder).toBeGreaterThan(1_000_000);
  });
});
