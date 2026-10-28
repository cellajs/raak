import type { ActorContext } from '#/core/context';
import { tenantRead } from '#/db/tenant-context';
import { TaskStatus, taskStatuses } from '#/modules/task/task-properties';
import { countTasksByStatus } from '#/modules/task/task-queries';

type TaskStatusCounts = Record<Lowercase<keyof typeof TaskStatus>, number>;

/** How many tasks of a project hold each status, every status present, for the project response's `counts`. */
export const getTaskStatusCounts = async (ctx: ActorContext, projectId: string): Promise<TaskStatusCounts> => {
  const rows = await tenantRead(ctx, (readCtx) => countTasksByStatus(readCtx, { projectId }));
  const countByStatus = new Map(rows.map(({ status, count }) => [status, count]));
  return Object.fromEntries(taskStatuses.map((status) => [TaskStatus[status].toLowerCase(), countByStatus.get(status) ?? 0])) as TaskStatusCounts;
};
