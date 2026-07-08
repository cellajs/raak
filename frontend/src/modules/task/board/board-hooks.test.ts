import { describe, expect, it } from 'vitest';
import type { EnrichedProject } from '~/modules/project/types';
import type { BoardResizablePanel } from '~/modules/task/types';
import { computePanelReorder, getPanelDisplayOrder, sortPanelsByOrder } from './board-hooks';

const makeProjectPanel = (projectId: string, displayOrder: number, panelId = projectId): BoardResizablePanel => ({
  panelId,
  project: {
    id: projectId,
    tenantId: 't',
    organizationId: 'o',
    membership: { id: `m-${projectId}`, displayOrder },
  } as unknown as EnrichedProject,
});

const makeExtraPanel = (panelId: string): BoardResizablePanel => ({ panelId });

describe('getPanelDisplayOrder', () => {
  it('reads server-owned membership.displayOrder for project panels', () => {
    expect(getPanelDisplayOrder(makeProjectPanel('a', 42))).toBe(42);
  });

  it('falls back to local orders for non-project panels', () => {
    expect(getPanelDisplayOrder(makeExtraPanel('explainer'), { explainer: 7 })).toBe(7);
  });

  it('returns undefined when neither source has an order', () => {
    expect(getPanelDisplayOrder(makeExtraPanel('explainer'))).toBeUndefined();
  });

  it('prefers server-owned order over local override for project panels', () => {
    expect(getPanelDisplayOrder(makeProjectPanel('a', 42), { a: 999 })).toBe(42);
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

  it('parks panels without any order at the end, preserving incoming relative order', () => {
    const panels = [
      makeProjectPanel('a', 30),
      makeExtraPanel('explainer'),
      makeExtraPanel('ai-chat'),
      makeProjectPanel('b', 10),
    ];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['b', 'a', 'explainer', 'ai-chat']);
  });

  it('keeps split panels grouped via their shared membership order', () => {
    const panels = [
      makeProjectPanel('a', 20, 'a-status-started'),
      makeProjectPanel('a', 20, 'a-status-finished'),
      makeProjectPanel('b', 10),
    ];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['b', 'a-status-started', 'a-status-finished']);
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
});
