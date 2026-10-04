import { describe, expect, it, vi } from 'vitest';
import { TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import { getNewTaskOrder, getStepTaskOrder } from './order-helpers';

// getNewTaskOrder is pure over its args; stub the cache accessor so importing order-helpers
// doesn't pull the query-client chain (which touches `window`) into the node test env.
const cache = vi.hoisted(() => ({ tasks: [] as unknown[] }));
vi.mock('~/modules/task/helpers/active-task', () => ({ cachedTasks: () => cache.tasks, currentActiveTask: () => undefined }));

const orderGap = 10;
const defaultOrder = 1000;

type OrderTask = Pick<Task, 'id' | 'displayOrder' | 'status' | '_draft' | 'projectId'>;
const task = (id: string, displayOrder: number, status: Task['status'], projectId = 'p1', _draft = false): OrderTask => ({
  id,
  displayOrder,
  status,
  projectId,
  _draft,
});

describe('getNewTaskOrder', () => {
  it('returns defaultOrder when no task matches the status', () => {
    expect(getNewTaskOrder(TaskStatus.Unstarted, [])).toBe(defaultOrder);
    expect(getNewTaskOrder(TaskStatus.Unstarted, [task('a', 50, TaskStatus.Started)])).toBe(defaultOrder);
  });

  it('places early-stage tasks (>= Unstarted) at the top: max order + gap', () => {
    const tasks = [task('a', 10, TaskStatus.Unstarted), task('b', 30, TaskStatus.Unstarted), task('c', 20, TaskStatus.Unstarted)];
    expect(getNewTaskOrder(TaskStatus.Unstarted, tasks)).toBe(30 + orderGap);
  });

  it('places later-stage tasks (< Unstarted) at the bottom: min order − gap', () => {
    const tasks = [task('a', 10, TaskStatus.Started), task('b', 30, TaskStatus.Started), task('c', 20, TaskStatus.Started)];
    expect(getNewTaskOrder(TaskStatus.Started, tasks)).toBe(10 - orderGap);
  });

  it('ignores draft tasks, other projects, and other statuses', () => {
    const tasks = [
      task('draft', 999, TaskStatus.Unstarted, 'p1', true),
      task('other-project', 999, TaskStatus.Unstarted, 'p2'),
      task('other-status', 999, TaskStatus.Started, 'p1'),
      task('match', 40, TaskStatus.Unstarted, 'p1'),
    ];
    expect(getNewTaskOrder(TaskStatus.Unstarted, tasks, 'p1')).toBe(40 + orderGap);
  });
});

describe('getStepTaskOrder', () => {
  // Higher display order sits higher in the column.
  const top = task('top', 30, TaskStatus.Started);
  const middle = task('middle', 20, TaskStatus.Started);
  const bottom = task('bottom', 10, TaskStatus.Started);
  const step = (item: OrderTask, direction: 'up' | 'down') => {
    cache.tasks = [bottom, task('other-status', 25, TaskStatus.Unstarted), top, task('other-project', 25, TaskStatus.Started, 'p2'), middle];
    return getStepTaskOrder(item as Task, direction);
  };

  it('moves a task above its upper neighbor', () => {
    expect(step(middle, 'up')).toBeGreaterThan(top.displayOrder);
    expect(step(bottom, 'up')).toBeGreaterThan(middle.displayOrder);
    expect(step(bottom, 'up')).toBeLessThan(top.displayOrder);
  });

  it('moves a task below its lower neighbor', () => {
    expect(step(middle, 'down')).toBeLessThan(bottom.displayOrder);
    expect(step(top, 'down')).toBeLessThan(middle.displayOrder);
    expect(step(top, 'down')).toBeGreaterThan(bottom.displayOrder);
  });

  it('returns null at either end, counting only tasks of the same project and status', () => {
    expect(step(top, 'up')).toBeNull();
    expect(step(bottom, 'down')).toBeNull();
  });
});
