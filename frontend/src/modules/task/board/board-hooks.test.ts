import { describe, expect, it } from 'vitest';
import type { EnrichedProject } from '~/modules/project/types';
import type { BoardResizablePanel } from '~/modules/task/types';
import { getPanelDisplayOrder, sortPanelsByOrder } from './board-hooks';

const makeProjectPanel = (projectId: string, displayOrder: number, panelId = projectId): BoardResizablePanel => ({
  panelId,
  project: {
    id: projectId,
    membership: { displayOrder },
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
