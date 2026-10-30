import { describe, expect, it, vi } from 'vitest';
import { shallow } from 'zustand/shallow';
import type { BoardPanelData, SectionsValue } from '~/modules/task/board/task-board-store';
import {
  defaultSplitSections,
  formatSectionLabel,
  mergePanelLayout,
  normalizePanelWidths,
  openViewSections,
  pickViewSections,
  projectPanelIds,
  splitPanelLayout,
} from '~/modules/task/helpers/board-helpers';
import { TaskStatus } from '~/modules/task/task-properties';
import type { ProjectResizablePanel } from '~/modules/task/types';

vi.mock('i18next', () => ({
  default: { t: (key: string, values?: Record<string, string>) => (values ? Object.values(values).join(` ${key} `) : key.replace('c:', '')) },
}));

const sections: SectionsValue[] = [{ status: [TaskStatus.Accepted] }, { status: [TaskStatus.Iced] }];
const prefs = { expandAccepted: false, expandIced: false };

describe('pickViewSections', () => {
  it('keeps split projects and omits unsplit ones', () => {
    const board: BoardPanelData = { split: { viewSections: sections, prefs }, unsplit: { prefs } };
    expect(pickViewSections(board)).toEqual({ split: sections });
    expect(pickViewSections(undefined)).toEqual({});
  });

  // Mirrors the immer update of an expand toggle: the touched panel and board are new objects.
  it('stays shallow-equal when only prefs change', () => {
    const before: BoardPanelData = { split: { viewSections: sections, prefs }, unsplit: { prefs } };
    const after: BoardPanelData = {
      split: { ...before.split, prefs: { ...prefs, expandIced: true } },
      unsplit: { prefs: { ...prefs, expandAccepted: true } },
      prefsOnly: { prefs },
    };
    expect(shallow(pickViewSections(before), pickViewSections(after))).toBe(true);
  });

  it('changes when a project is split', () => {
    const before: BoardPanelData = { a: { prefs } };
    const after: BoardPanelData = { a: { viewSections: sections, prefs } };
    expect(shallow(pickViewSections(before), pickViewSections(after))).toBe(false);
  });
});

describe('defaultSplitSections', () => {
  it('holds every status in exactly one section', () => {
    const statuses = Object.values(TaskStatus).filter((value) => typeof value === 'number');
    const inSections = defaultSplitSections.flatMap((section) => section.status);
    expect([...inSections].sort()).toEqual([...statuses].sort());
  });
});

describe('formatSectionLabel', () => {
  it('names one status, a pair and a run', () => {
    expect(formatSectionLabel({ status: [TaskStatus.Iced] })).toBe('iced');
    expect(formatSectionLabel(defaultSplitSections[1])).toBe('unstarted c:status_pair iced');
    expect(formatSectionLabel(defaultSplitSections[0])).toBe('started c:status_range accepted');
  });

  it('lists statuses that are no run', () => {
    expect(formatSectionLabel({ status: [TaskStatus.Accepted, TaskStatus.Started, TaskStatus.Delivered] })).toBe('started, delivered, accepted');
  });
});

describe('split and merge widths', () => {
  it('shares the width over the sections and sums it back', () => {
    const panelIds = projectPanelIds('p', defaultSplitSections);
    const split = splitPanelLayout({ p: 800, other: 400 }, 'p', panelIds);
    expect(split).toEqual({ other: 400, [panelIds[0]]: 400, [panelIds[1]]: 400 });
    expect(mergePanelLayout(split, 'p', panelIds)).toEqual({ other: 400, p: 800 });
  });

  it('keeps sections at the minimum width', () => {
    const panelIds = projectPanelIds('p', defaultSplitSections);
    expect(splitPanelLayout({ p: 50 }, 'p', panelIds)[panelIds[0]]).toBe(300);
    expect(mergePanelLayout({ [panelIds[0]]: 50, [panelIds[1]]: 50 }, 'p', panelIds).p).toBe(300);
  });

  it('leaves a project without a stored width to the default', () => {
    expect(splitPanelLayout({ other: 400 }, 'p', ['p-a', 'p-b'])).toEqual({ other: 400 });
  });

  it('keeps a collapsed project collapsed when it merges', () => {
    expect(mergePanelLayout({ p: 50, 'p-a': 500, 'p-b': 400 }, 'p', ['p-a', 'p-b'])).toEqual({ p: 50 });
  });

  it('expands a collapsed project when it splits', () => {
    const panelIds = projectPanelIds('p', defaultSplitSections);
    expect(openViewSections({ p: defaultSplitSections }, splitPanelLayout({ p: 50 }, 'p', panelIds))).toEqual({ p: defaultSplitSections });
  });
});

describe('openViewSections', () => {
  it('leaves out a project collapsed on this board, and no other', () => {
    expect(openViewSections({ a: sections, b: sections, c: sections }, { a: 50, b: 400 })).toEqual({ b: sections, c: sections });
    expect(openViewSections({ a: sections })).toEqual({ a: sections });
  });
});

describe('normalizePanelWidths', () => {
  const panel = (panelId: string, sectionFilters?: SectionsValue) => ({ kind: 'project', panelId, sectionFilters }) as ProjectResizablePanel;

  it('defaults missing widths and drops panels off the board', () => {
    expect(normalizePanelWidths({ gone: 500, a: 400 }, [panel('a'), panel('b')])).toEqual({ a: 400, b: 300 });
  });

  it('lets a panel stay collapsed, but opens a section stored collapsed', () => {
    expect(normalizePanelWidths({ a: 50, s: 50 }, [panel('a'), panel('s', sections[0])])).toEqual({ a: 50, s: 300 });
  });
});
