import { describe, expect, it } from 'vitest';
import { collectLabelHeat, heatHalfLifeMs, heatRank, heatWeights } from '#/modules/label/helpers/label-heat';
import { TaskStatus } from '#/modules/task/task-properties';

const task = (labels: string[], status: TaskStatus) => ({ labels, status });

describe('collectLabelHeat', () => {
  it('counts a created task once per label', () => {
    expect(collectLabelHeat([task(['a', 'b'], TaskStatus.Unstarted)])).toEqual(
      new Map([
        ['a', 1],
        ['b', 1],
      ]),
    );
  });

  it('counts a label added to a task, not one taken off', () => {
    const bumps = collectLabelHeat([task(['a', 'c'], TaskStatus.Unstarted)], [task(['a', 'b'], TaskStatus.Unstarted)]);
    expect(bumps).toEqual(new Map([['c', heatWeights.labelAdded]]));
  });

  it('weighs a start double and a move to finished or reviewed single', () => {
    expect(collectLabelHeat([task(['a'], TaskStatus.Started)], [task(['a'], TaskStatus.Unstarted)])).toEqual(new Map([['a', 2]]));
    expect(collectLabelHeat([task(['a'], TaskStatus.Finished)], [task(['a'], TaskStatus.Started)])).toEqual(new Map([['a', 1]]));
    expect(collectLabelHeat([task(['a'], TaskStatus.Reviewed)], [task(['a'], TaskStatus.Finished)])).toEqual(new Map([['a', 1]]));
    expect(collectLabelHeat([task(['a'], TaskStatus.Iced)], [task(['a'], TaskStatus.Unstarted)])).toEqual(new Map());
  });

  it('adds nothing for an accepted task, moved there or edited there', () => {
    expect(collectLabelHeat([task(['a'], TaskStatus.Accepted)], [task(['a'], TaskStatus.Reviewed)])).toEqual(new Map());
    expect(collectLabelHeat([task(['a', 'b'], TaskStatus.Accepted)], [task(['a'], TaskStatus.Accepted)])).toEqual(new Map());
    expect(collectLabelHeat([task(['a'], TaskStatus.Accepted)])).toEqual(new Map());
  });

  it('sums the bumps of a batch, a label added to a task that also starts included', () => {
    const bumps = collectLabelHeat(
      [task(['a'], TaskStatus.Unstarted), task(['a', 'b'], TaskStatus.Started)],
      [undefined, task(['a'], TaskStatus.Unstarted)],
    );
    expect(bumps).toEqual(
      new Map([
        ['a', 3],
        ['b', 3],
      ]),
    );
  });
});

describe('heatRank', () => {
  it('ranks the same heat one higher per half-life, so a week-old bump counts half', () => {
    const now = Date.UTC(2026, 10, 3);
    expect(heatRank(2, now) - heatRank(2, now - heatHalfLifeMs)).toBeCloseTo(1);
    expect(heatRank(2, now)).toBeCloseTo(heatRank(1, now) + 1);
  });
});
