import '~/query/tests/query-client-env';
import { describe, expect, it } from 'vitest';
import type { EnrichedProject } from '~/modules/project/types';
import type { BoardResizablePanel, ProjectResizablePanel } from '~/modules/task/types';
import { computePanelReorder, getPanelDisplayOrder, sortPanelsByOrder } from './board-hooks';

const makeProjectPanel = (projectId: string, displayOrder: number, panelId = projectId): ProjectResizablePanel => ({
  kind: 'project',
  panelId,
  project: { id: projectId, tenantId: 't', organizationId: 'o', membership: { id: `m-${projectId}`, displayOrder } } as unknown as EnrichedProject,
});

// A status panel of a project, as prepareBoardPanels makes it: its offset keeps it from tying with the project's panel.
const makeStatusPanel = (projectId: string, displayOrder: number, panelId: string, orderOffset: number): BoardResizablePanel => ({
  ...makeProjectPanel(projectId, displayOrder, panelId),
  statuses: [],
  orderOffset,
});

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

  it('orders a status panel after its project, unless a local order moved it', () => {
    expect(getPanelDisplayOrder(makeStatusPanel('a', 20, 'a-s1', 3))).toBe(23);
    expect(getPanelDisplayOrder(makeStatusPanel('a', 20, 'a-s1', 3), { 'a-s1': 5 })).toBe(5);
    expect(getPanelDisplayOrder(makeStatusPanel('a', 20, 'a-s1', 3), { a: 5 })).toBe(23);
  });
});

describe('sortPanelsByOrder', () => {
  it('sorts project panels by membership.displayOrder', () => {
    const panels = [makeProjectPanel('a', 30), makeProjectPanel('b', 10), makeProjectPanel('c', 20)];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['b', 'c', 'a']);
  });

  it('intersperses local-only panels by their stored displayOrder', () => {
    const panels = [makeProjectPanel('a', 30), makeProjectPanel('b', 10), makeExtraPanel('explainer'), makeLabelsPanel()];
    const sorted = sortPanelsByOrder(panels, { explainer: 5, labels: 20 });
    expect(sorted.map((p) => p.panelId)).toEqual(['explainer', 'b', 'labels', 'a']);
  });

  it('anchors kind defaults: explainer leads, labels trails, unknown kinds park at the end', () => {
    const panels = [makeProjectPanel('a', 30), makeLabelsPanel(), makeExtraPanel('explainer'), makeProjectPanel('b', 10)];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['explainer', 'b', 'a', 'labels']);
  });

  it('keeps status panels after their project and ahead of labels, in their own order', () => {
    const panels = [makeLabelsPanel(), makeStatusPanel('a', 20, 'a-iced', 7), makeStatusPanel('a', 20, 'a-started', 2), makeProjectPanel('a', 20)];
    expect(sortPanelsByOrder(panels).map((p) => p.panelId)).toEqual(['a', 'a-started', 'a-iced', 'labels']);
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

  it('moves a status panel between its neighbours by a local order', () => {
    const panels = [makeProjectPanel('a', 10), makeStatusPanel('a', 10, 'a-s0', 1), makeStatusPanel('a', 10, 'a-s1', 2)];
    const result = computePanelReorder(panels, undefined, ['a', 'a-s1', 'a-s0'], 'a-s1', { persist: 'local' });
    expect(result).toMatchObject({ kind: 'local', panelId: 'a-s1' });
    if (result?.kind === 'local') {
      expect(result.displayOrder).toBeGreaterThan(10);
      expect(result.displayOrder).toBeLessThan(11);
    }
  });

  it('forces a local order for a project panel when persist is local', () => {
    const panels = [makeProjectPanel('a', 10), makeLabelsPanel()];
    const result = computePanelReorder(panels, undefined, ['labels', 'a'], 'a', { persist: 'local' });
    expect(result).toMatchObject({ kind: 'local', panelId: 'a' });
    if (result?.kind === 'local') expect(result.displayOrder).toBeGreaterThan(1_000_000);
  });
});
