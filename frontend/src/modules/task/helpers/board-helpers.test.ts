import { describe, expect, it, vi } from 'vitest';
import type { EnrichedProject } from '~/modules/project/types';
import {
  foldsStatus,
  formatStatusesLabel,
  normalizePanelWidths,
  prepareBoardPanels,
  statusesBottomUp,
  statusPanelId,
  statusPath,
  statusTabLists,
} from '~/modules/task/helpers/board-helpers';
import { TaskStatus } from '~/modules/task/task-properties';
import type { ProjectResizablePanel } from '~/modules/task/types';

vi.mock('i18next', () => ({
  default: { t: (key: string, values?: Record<string, string>) => (values ? Object.values(values).join(` ${key} `) : key.replace('c:', '')) },
}));

const project = { id: 'p' } as EnrichedProject;

describe('statusPath', () => {
  it('holds every status once', () => {
    const statuses = Object.values(TaskStatus).filter((value) => typeof value === 'number');
    expect([...statusPath].sort()).toEqual([...statuses].sort());
  });
});

describe('statusesBottomUp', () => {
  it('runs from iced to accepted', () => {
    expect(statusesBottomUp).toEqual([
      TaskStatus.Iced,
      TaskStatus.Unstarted,
      TaskStatus.Started,
      TaskStatus.Finished,
      TaskStatus.Delivered,
      TaskStatus.Reviewed,
      TaskStatus.Accepted,
    ]);
  });
});

describe('statusTabLists', () => {
  it('lists each status alone under its name', () => {
    expect(statusTabLists.get('accepted')).toEqual([TaskStatus.Accepted]);
    expect(statusTabLists.get('unstarted')).toEqual([TaskStatus.Unstarted]);
    expect(statusTabLists.size).toBe(statusPath.length);
  });

  it('knows no other tab, inherited names included', () => {
    expect(statusTabLists.get('constructor')).toBeUndefined();
  });
});

describe('prepareBoardPanels', () => {
  it('gives each project one panel without status panels', () => {
    expect(prepareBoardPanels([project])).toEqual([{ kind: 'project', project, panelId: 'p' }]);
  });

  it('leaves the project panel the statuses without a panel of their own, in workflow order', () => {
    const [main, ...own] = prepareBoardPanels([project], [TaskStatus.Iced, TaskStatus.Unstarted]);
    expect(main.panelId).toBe('p');
    expect(main.statuses).toEqual([TaskStatus.Started, TaskStatus.Finished, TaskStatus.Delivered, TaskStatus.Reviewed, TaskStatus.Accepted]);
    expect(own.map(({ panelId, statuses }) => [panelId, statuses])).toEqual([
      [statusPanelId('p', TaskStatus.Iced), [TaskStatus.Iced]],
      [statusPanelId('p', TaskStatus.Unstarted), [TaskStatus.Unstarted]],
    ]);
  });

  it('lines status panels up from the status the board starts with, with the project panel after them', () => {
    const ids = (startWith: 'accepted' | 'iced') =>
      prepareBoardPanels([project], [TaskStatus.Accepted, TaskStatus.Unstarted], startWith)
        .sort((a, b) => (a.orderOffset ?? 0) - (b.orderOffset ?? 0))
        .map(({ panelId }) => panelId);

    const acceptedPanel = statusPanelId('p', TaskStatus.Accepted);
    const backlogPanel = statusPanelId('p', TaskStatus.Unstarted);
    expect(ids('accepted')).toEqual([acceptedPanel, backlogPanel, 'p']);
    expect(ids('iced')).toEqual([backlogPanel, acceptedPanel, 'p']);
  });

  it('drops the project panel when every status has its own', () => {
    const panels = prepareBoardPanels([project], statusPath);
    expect(panels).toHaveLength(statusPath.length);
    expect(panels.some(({ panelId }) => panelId === 'p')).toBe(false);
  });
});

describe('foldsStatus', () => {
  it('folds a status listed among others, in a panel of all or of some', () => {
    expect(foldsStatus(undefined, TaskStatus.Iced)).toBe(true);
    expect(foldsStatus([TaskStatus.Started, TaskStatus.Iced], TaskStatus.Iced)).toBe(true);
  });

  it('does not fold a status listed alone or not at all', () => {
    expect(foldsStatus([TaskStatus.Iced], TaskStatus.Iced)).toBe(false);
    expect(foldsStatus([TaskStatus.Started, TaskStatus.Finished], TaskStatus.Iced)).toBe(false);
  });
});

describe('formatStatusesLabel', () => {
  it('names one status, a pair and more', () => {
    expect(formatStatusesLabel([TaskStatus.Iced])).toBe('iced');
    expect(formatStatusesLabel([TaskStatus.Unstarted, TaskStatus.Iced])).toBe('unstarted c:status_pair iced');
    expect(formatStatusesLabel([TaskStatus.Finished, TaskStatus.Reviewed, TaskStatus.Accepted])).toBe('finished c:status_range accepted');
  });
});

describe('normalizePanelWidths', () => {
  const panel = (panelId: string) => ({ kind: 'project', panelId }) as ProjectResizablePanel;

  it('defaults missing widths and drops panels off the board', () => {
    expect(normalizePanelWidths({ gone: 500, a: 400 }, [panel('a'), panel('b')])).toEqual({ a: 400, b: 300 });
  });

  it('lets a panel stay collapsed', () => {
    expect(normalizePanelWidths({ a: 50 }, [panel('a')])).toEqual({ a: 50 });
  });
});
