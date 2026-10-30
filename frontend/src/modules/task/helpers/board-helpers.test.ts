import { describe, expect, it, vi } from 'vitest';
import { shallow } from 'zustand/shallow';
import type { BoardPanelData, SectionsValue } from '~/modules/task/board/task-board-store';
import {
  defaultSplitSections,
  formatSectionLabel,
  mergePanelLayout,
  pickViewSections,
  projectPanelIds,
  splitPanelLayout,
} from '~/modules/task/helpers/board-helpers';
import { TaskStatus } from '~/modules/task/task-properties';

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
});
