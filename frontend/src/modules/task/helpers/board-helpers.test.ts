import { describe, expect, it } from 'vitest';
import { shallow } from 'zustand/shallow';
import type { BoardPanelData, SectionsValue } from '~/modules/task/board/task-board-store';
import { pickViewSections } from '~/modules/task/helpers/board-helpers';
import { TaskStatus } from '~/modules/task/task-properties';

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
