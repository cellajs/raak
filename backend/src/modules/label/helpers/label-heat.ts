import { TaskStatus } from '#/modules/task/task-properties';

/** Heat halves every week, so last week's work counts half of this week's. */
export const heatHalfLifeMs = 7 * 24 * 60 * 60 * 1000;

/** What a task write adds to each label on the task; an epic takes double. */
export const heatWeights = { created: 1, labelAdded: 1, started: 2, moved: 1 } as const;

/**
 * The time axis of a rank: half-lives since the epoch. A label's `displayOrder` is `log2(heat) + clock` at its last bump,
 * which keeps the order between untouched labels as their heat decays, so decay never rewrites a row.
 */
export const heatClock = (nowMs = Date.now()) => nowMs / heatHalfLifeMs;

/** The rank a label with `heat` takes now. */
export const heatRank = (heat: number, nowMs?: number) => Math.log2(heat) + heatClock(nowMs);

/** The columns of a task row a bump reads. */
export interface TaskHeatRow {
  labels: string[];
  status: number;
}

const statusWeight = (status: number) => {
  if (status === TaskStatus.Started) return heatWeights.started;
  if (status === TaskStatus.Finished || status === TaskStatus.Reviewed) return heatWeights.moved;
  return 0;
};

/**
 * Label id → the heat the written tasks add, `before` index-aligned with `after` and absent for creates. Nothing on an
 * accepted task: that work is done, and a label put on it later says nothing about what is hot.
 */
export const collectLabelHeat = (after: TaskHeatRow[], before: (TaskHeatRow | undefined)[] = []): Map<string, number> => {
  const bumps = new Map<string, number>();
  const add = (id: string, weight: number) => {
    if (weight > 0) bumps.set(id, (bumps.get(id) ?? 0) + weight);
  };

  after.forEach((task, index) => {
    if (task.status === TaskStatus.Accepted) return;
    const previous = before[index];
    if (!previous) {
      for (const id of task.labels) add(id, heatWeights.created);
      return;
    }
    for (const id of task.labels) if (!previous.labels.includes(id)) add(id, heatWeights.labelAdded);
    if (task.status !== previous.status) for (const id of task.labels) add(id, statusWeight(task.status));
  });

  return bumps;
};
