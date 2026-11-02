import { describe, expect, it, vi } from 'vitest';
import { type DemoStage, playDemoRound } from '~/modules/marketing/about/demo/demo-script';
import { darkModeTask, demoSeed, demoType, exportTask, syncStateTask, typoTask, website } from '~/modules/marketing/about/demo/fixtures';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

// The real module pulls in the task dropdowns, which read the viewport on import
vi.mock('~/modules/task/helpers/open-task-dropdown', () => ({ taskFieldTriggerId: (field: string, id: string) => `${field}-${id}` }));

/** Plays a round without timers, applying every change to a copy of the seed; the board does the same to its state. */
const playRound = async (isPhone: boolean) => {
  const tasks = new Map(demoSeed(isPhone).map((task) => [task.id, task]));
  const calls: string[] = [];
  const log = (name: string) => () => {
    calls.push(name);
  };

  const stage: DemoStage = {
    isPhone,
    sleep: async () => {},
    point: log('point'),
    press: async () => {},
    hideCursor: log('hideCursor'),
    addTask: (task: Task) => {
      tasks.set(task.id, task);
    },
    patchTask: (id, change) => {
      const task = tasks.get(id);
      if (!task) throw new Error(`patched an unknown task: ${id}`);
      tasks.set(id, { ...task, ...change(task) });
    },
    emphasize: log('emphasize'),
    markNew: log('markNew'),
    openTypeMenu: log('openTypeMenu'),
    highlightType: log('highlightType'),
    closeTypeMenu: log('closeTypeMenu'),
    carry: log('carry'),
    carryTo: log('carryTo'),
    drop: log('drop'),
    dragDivider: async () => {
      calls.push('dragDivider');
    },
    showProject: log('showProject'),
    reset: async () => {
      calls.push('reset');
    },
  };

  await playDemoRound(stage);
  return { tasks, calls };
};

describe('playDemoRound', () => {
  it('adds, starts, retypes and labels, then moves a task where two projects show', async () => {
    const { tasks, calls } = await playRound(false);

    expect(tasks.get(exportTask.id)?.summary).toBe(exportTask.summary);
    expect(tasks.get(exportTask.id)?.name).toBe(exportTask.name);
    expect(tasks.get(darkModeTask.id)?.status).toBe(TaskStatus.Started);
    expect(tasks.get(typoTask.id)?.primaryLabelId).toBe(demoType('chore').id);
    expect(tasks.get(typoTask.id)?.labels.map(({ name }) => name)).toEqual(['copy']);
    expect(tasks.get(syncStateTask.id)?.projectId).toBe(website.id);
    expect(calls.at(-1)).toBe('reset');
    expect(calls.indexOf('closeTypeMenu')).toBeGreaterThan(calls.indexOf('openTypeMenu'));
    expect(calls.indexOf('drop')).toBeGreaterThan(calls.indexOf('carry'));
    expect(calls.indexOf('dragDivider')).toBeGreaterThan(calls.indexOf('drop'));
    expect(calls).not.toContain('showProject');
  });

  it('opens the other project on a phone instead of moving a task and resizing', async () => {
    const { tasks, calls } = await playRound(true);

    expect(calls).not.toContain('carry');
    expect(calls).not.toContain('dragDivider');
    expect(calls).toContain('showProject');
    expect(tasks.get(syncStateTask.id)?.projectId).toBe(syncStateTask.projectId);
    expect(tasks.get(typoTask.id)?.primaryLabelId).toBe(demoType('chore').id);
  });
});

describe('demoSeed', () => {
  it('starts each task of the round in the state the script changes it from', () => {
    for (const isPhone of [false, true]) {
      const seed = new Map(demoSeed(isPhone).map((task) => [task.id, task]));
      expect(seed.get(darkModeTask.id)?.status).toBe(TaskStatus.Unstarted);
      expect(seed.get(typoTask.id)?.primaryLabel?.slug).toBe('bug');
      expect(seed.has(exportTask.id)).toBe(false);
    }
  });
});
