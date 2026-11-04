import { describe, expect, it, vi } from 'vitest';
import type { ProjectWithMembership } from '~/modules/project/types';
import {
  countTasksByStatus,
  foldsStatus,
  formatStatusesLabel,
  normalizePanelWidths,
  prepareBoardPanels,
  publicBoardPanels,
  statusesBottomUp,
  statusPanelId,
  statusPath,
  statusTabLists,
} from '~/modules/task/helpers/board-helpers';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { ProjectResizablePanel, Task } from '~/modules/task/types';

vi.mock('i18next', () => ({
  default: { t: (key: string, values?: Record<string, string>) => (values ? Object.values(values).join(` ${key} `) : key.replace('c:', '')) },
}));

const project = { id: 'p' } as ProjectWithMembership;

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
      TaskStatus.Reviewed,
      TaskStatus.Accepted,
    ]);
  });
});

describe('statusOptions', () => {
  it('moves a task along the path one status at a time, past the retired gap', () => {
    const walked = statusPath.slice(0, -2).map((status) => statusOptionsByValue[status].next);
    expect(walked).toEqual([TaskStatus.Started, TaskStatus.Finished, TaskStatus.Reviewed, TaskStatus.Accepted]);
    expect(statusOptionsByValue[TaskStatus.Iced].next).toBe(TaskStatus.Unstarted);
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
    expect(main.statuses).toEqual([TaskStatus.Started, TaskStatus.Finished, TaskStatus.Reviewed, TaskStatus.Accepted]);
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

describe('prepareBoardPanels without the rest panel', () => {
  it('leaves out the panel of the remaining statuses', () => {
    const panels = prepareBoardPanels([project], [TaskStatus.Started], 'accepted', true);
    expect(panels.map(({ statuses }) => statuses)).toEqual([[TaskStatus.Started]]);
  });

  it('keeps the one panel of a board without status panels', () => {
    expect(prepareBoardPanels([project], [], 'accepted', true)).toEqual([{ kind: 'project', project, panelId: 'p' }]);
  });
});

describe('countTasksByStatus', () => {
  const items = (...tasks: Partial<Task>[]) => ({ items: tasks as Task[] });

  it('counts each status with tasks and leaves the others out', () => {
    const counts = countTasksByStatus(items({ status: TaskStatus.Started }, { status: TaskStatus.Started }, { status: TaskStatus.Accepted }));
    expect(counts).toEqual({ [TaskStatus.Started]: 2, [TaskStatus.Accepted]: 1 });
  });

  it('leaves out the create-form draft', () => {
    expect(countTasksByStatus(items({ status: TaskStatus.Unstarted, _draft: true }))).toEqual({});
  });
});

describe('publicBoardPanels', () => {
  const tasks = (...statuses: TaskStatus[]) => statuses.map((status) => ({ status }));

  it('assumes all of them before the tasks load', () => {
    expect(publicBoardPanels()).toEqual({ statusPanels: [TaskStatus.Started, TaskStatus.Finished, TaskStatus.Reviewed], withoutRest: false });
  });

  it('leaves out a status without tasks, which then stays in nobody', () => {
    expect(publicBoardPanels(tasks(TaskStatus.Started, TaskStatus.Accepted))).toEqual({ statusPanels: [TaskStatus.Started], withoutRest: false });
  });

  it('leaves out the rest panel when no task is left for it', () => {
    expect(publicBoardPanels(tasks(TaskStatus.Started, TaskStatus.Finished))).toEqual({
      statusPanels: [TaskStatus.Started, TaskStatus.Finished],
      withoutRest: true,
    });
  });

  it('never gives more than four panels', () => {
    const everything = tasks(...statusPath);
    const { statusPanels, withoutRest } = publicBoardPanels(everything);
    expect(prepareBoardPanels([project], statusPanels, 'accepted', withoutRest)).toHaveLength(4);
  });

  it('gives one panel to a project without tasks', () => {
    const { statusPanels, withoutRest } = publicBoardPanels([]);
    expect(prepareBoardPanels([project], statusPanels, 'accepted', withoutRest)).toEqual([{ kind: 'project', project, panelId: 'p' }]);
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
    expect(formatStatusesLabel([TaskStatus.Finished, TaskStatus.Reviewed, TaskStatus.Accepted])).toBe('delivered c:status_range done');
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
