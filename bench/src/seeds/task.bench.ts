import type { InsertTaskModel } from '#/modules/task/task-db';
import { mockTask } from '#/modules/task/task-mocks';
import { registerBenchSeed } from '../registry';
import { CORE_ID_VARIANTS, ORG_ID, projectId, TENANT_ID, taskId, userId } from './ids';
import { TOTAL_PROJECTS } from './project.bench';

export const TOTAL_TASKS = 500;

/**
 * Generate a load-test task row by index.
 *
 * `mockTask` leaks `statusChangedAt`/`deletedAt`/`deletedBy` keys that are not
 * real `tasks` columns, so they are stripped (the registry derives INSERT
 * columns from the row's keys).
 */
export const loadtestTask = (index: number): InsertTaskModel => {
  const {
    statusChangedAt: _statusChangedAt,
    deletedAt: _deletedAt,
    deletedBy: _deletedBy,
    ...record
  } = mockTask(`task:loadtest:${index}`) as InsertTaskModel & {
    statusChangedAt?: unknown;
    deletedAt?: unknown;
    deletedBy?: unknown;
  };
  return {
    ...record,
    id: taskId(index),
    tenantId: TENANT_ID,
    name: `Load Test Task ${index}`,
    description: '<p>Initial task description.</p>',
    keywords: '',
    summary: '',
    summaryLength: 0,
    expandable: false,
    variant: 1,
    status: 5,
    displayOrder: index + 1,
    labels: [],
    assignedTo: [],
    organizationId: ORG_ID,
    projectId: projectId(index % TOTAL_PROJECTS),
    createdBy: userId(index),
    updatedBy: userId(index),
    checkboxCount: 0,
    checkedCount: 0,
  };
};

// Seeds after projects (order 110): tasks FK-reference a project. `labels` and
// `assigned_to` are native Postgres arrays (see `pgArrayColumns`).
registerBenchSeed({
  table: 'tasks',
  order: 120,
  pgArrayColumns: ['labels', 'assigned_to'],
  idVariant: CORE_ID_VARIANTS.task,
  rows: ({ now }) => Array.from({ length: TOTAL_TASKS }, (_, i) => ({ ...loadtestTask(i), createdAt: now, seq: 0 })),
});
