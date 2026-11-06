import { describe, expect, it } from 'vitest';
import type { ProjectWithMembership } from '~/modules/project/types';
import { normalizePanelWidths, prepareBoardPanels, projectPageGroups, projectPagePanelId } from '~/modules/task/helpers/board-helpers';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { ProjectResizablePanel } from '~/modules/task/types';

const project = { id: 'p' } as ProjectWithMembership;
const everyStatus = Object.values(TaskStatus).filter((value) => typeof value === 'number');

describe('statusOptions', () => {
  it('moves a task along the path one status at a time, past the retired gap', () => {
    const walked = [TaskStatus.Unstarted, TaskStatus.Started, TaskStatus.Finished, TaskStatus.Reviewed].map(
      (status) => statusOptionsByValue[status].next,
    );
    expect(walked).toEqual([TaskStatus.Started, TaskStatus.Finished, TaskStatus.Reviewed, TaskStatus.Accepted]);
    expect(statusOptionsByValue[TaskStatus.Iced].next).toBe(TaskStatus.Unstarted);
  });
});

describe('prepareBoardPanels', () => {
  it('gives each project one panel on a workspace board', () => {
    expect(prepareBoardPanels([project])).toEqual([{ kind: 'project', project, panelId: 'p' }]);
  });

  it('lists every status in exactly one project page panel', () => {
    const listed = prepareBoardPanels([project], true).flatMap(({ statuses }) => statuses ?? []);
    expect(listed.toSorted()).toEqual(everyStatus.toSorted());
  });

  it('finds the panel that lists a status by its id', () => {
    const panels = prepareBoardPanels([project], true);
    for (const status of everyStatus) {
      const host = panels.find(({ panelId }) => panelId === projectPagePanelId('p', status));
      expect(host?.statuses).toContain(status);
    }
  });
});

describe('projectPageGroups', () => {
  it('starts a task created from a panel in a status that panel lists', () => {
    for (const { statuses, entry } of projectPageGroups) expect(statuses).toContain(entry);
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
