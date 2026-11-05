import { describe, expect, it } from 'vitest';
import type { ProjectWithMembership } from '~/modules/project/types';
import {
  countTasksByStatus,
  normalizePanelWidths,
  prepareBoardPanels,
  projectPagePanelId,
  statusesBottomUp,
  statusPath,
  statusTabLists,
} from '~/modules/task/helpers/board-helpers';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { ProjectResizablePanel, Task } from '~/modules/task/types';

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
  it('gives each project one panel on a workspace board', () => {
    expect(prepareBoardPanels([project])).toEqual([{ kind: 'project', project, panelId: 'p' }]);
  });

  it('lists every status in exactly one project page panel', () => {
    const listed = prepareBoardPanels([project], true).flatMap(({ statuses }) => statuses ?? []);
    expect(listed.toSorted()).toEqual(statusPath.toSorted());
  });

  it('finds the panel that lists a status by its id', () => {
    const panels = prepareBoardPanels([project], true);
    for (const status of statusPath) {
      const host = panels.find(({ panelId }) => panelId === projectPagePanelId('p', status));
      expect(host?.statuses).toContain(status);
    }
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

describe('normalizePanelWidths', () => {
  const panel = (panelId: string) => ({ kind: 'project', panelId }) as ProjectResizablePanel;

  it('defaults missing widths and drops panels off the board', () => {
    expect(normalizePanelWidths({ gone: 500, a: 400 }, [panel('a'), panel('b')])).toEqual({ a: 400, b: 300 });
  });

  it('lets a panel stay collapsed', () => {
    expect(normalizePanelWidths({ a: 50 }, [panel('a')])).toEqual({ a: 50 });
  });
});
